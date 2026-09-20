import { randomUUID, createHash } from 'node:crypto';
import { validEmail } from '@/lib/server/mailer';
import { getErrorReports } from '@/lib/server/error-reports';
import { accountRecoveryAvailable } from '@/lib/server/account-recovery';
import { containsSupportSecret, diagnosticPath, safeDiagnostic } from '@/lib/shared/support/validation';
import { CATEGORIES, TICKET_STATUSES, PRIORITIES, BUG_STATUSES, RECOVERY_OUTCOMES, RESPONSE_HOURS, type Ticket, type PublicTicket, type AdminTicket, type Bug, type Workspace, type Priority } from '@/lib/shared/support/model';
import { audit, supportTransaction, SupportError, supportStorageReady, type SupportStore } from './store';
import { safeEqual, secretHash } from './auth';

type Input = Record<string, unknown>;
export function inputObject(input: unknown): Input { if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SupportError('Invalid request.'); return input as Input; }
function text(value: unknown, name: string, max: number, required = true): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new SupportError(`${name} is required and must be no longer than ${max} characters.`);
  const result = value.trim();
  if (containsSupportSecret(result)) throw new SupportError('Remove recovery words, passphrases, PINs and private keys before sending this message.');
  return result;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T { if (typeof value !== 'string' || !choices.includes(value as T)) throw new SupportError('Invalid workflow value.'); return value as T; }
function uuid(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value)) throw new SupportError('Invalid request identifier.'); return value; }
function requireVersion(value: unknown, version: number) { if (value !== version) throw new SupportError('This record changed. Refresh it before saving your edits.', 409); }
const publicView = (ticket: Ticket): PublicTicket => ({ id: ticket.id, subject: ticket.subject, category: ticket.category, status: ticket.status, resolution: ticket.resolution, createdAt: ticket.createdAt, updatedAt: ticket.updatedAt, version: ticket.version, messages: ticket.messages.filter(message => message.visibility === 'public').map(message => ({ ...message, authorName: message.author === 'admin' ? 'Zik Support' : 'You' })) });
const adminView = ({ accessHash: _hash, creationId: _creation, ...ticket }: Ticket): AdminTicket => { void _hash; void _creation; return ticket; };
function authorizedTicket(data: SupportStore, id: string, token: string) {
  const ticket = data.tickets.find(t => t.id === id);
  if (!ticket || !/^[A-Za-z0-9_-]{43}$/.test(token) || !safeEqual(ticket.accessHash, secretHash(token))) throw new SupportError('Ticket access was not recognised. Use your private ticket link.', 404);
  return ticket;
}
export async function createTicket(value: unknown) {
  const input = inputObject(value);
  const creationId = uuid(input.requestId);
  const token = typeof input.accessKey === 'string' && /^[A-Za-z0-9_-]{43}$/.test(input.accessKey) ? input.accessKey : '';
  if (!token) throw new SupportError('A secure ticket access key is required.');
  const subject = text(input.subject, 'Subject', 160), body = text(input.body, 'Description', 6000);
  const category = choice(input.category, CATEGORIES);
  const email = text(input.email, 'Contact email', 254, false);
  if (email && !validEmail(email)) throw new SupportError('Enter a valid contact email or leave it blank.');
  const reference = text(input.errorReference, 'Error reference', 80, false);
  if (reference && !/^err_[A-Za-z0-9_-]+$/.test(reference)) throw new SupportError('Use the error reference shown by Zik, or leave it blank.');
  const diagnostic = text(input.diagnostic, 'Diagnostics', 500, false);
  return supportTransaction(data => {
    const existing = data.tickets.find(t => t.creationId === creationId);
    if (existing) { if (!safeEqual(existing.accessHash, secretHash(token))) throw new SupportError('Invalid duplicate request.', 409); return publicView(existing); }
    if (data.tickets.length >= 10000) throw new SupportError('The help desk is temporarily at capacity. Please try again later.', 503);
    const now = new Date().toISOString();
    const priority = category === 'recovery' || category === 'privacy' ? 'high' : 'normal';
    const ticket: Ticket = { id: `help_${randomUUID()}`, accessHash: secretHash(token), creationId, subject, category, contactEmail: email || undefined, errorReference: reference || undefined, diagnostic: diagnostic || undefined,
      status: 'open', priority, assignee: '', resolution: '', recoveryOutcome: 'not_reviewed', createdAt: now, updatedAt: now, dueAt: new Date(Date.now() + RESPONSE_HOURS[priority] * 3600000).toISOString(), version: 1,
      messages: [{ id: randomUUID(), requestId: creationId, author: 'customer', authorName: 'Customer', visibility: 'public', body, createdAt: now }] };
    data.tickets.push(ticket); audit(data, 'customer', 'ticket.created', ticket.id, [category]);
    return publicView(ticket);
  });
}
export async function readCustomerTicket(id: string, token: string) { return supportTransaction(data => publicView(authorizedTicket(data, id, token))); }
export async function replyToTicket(id: string, token: string, value: unknown) {
  const input = inputObject(value), body = text(input.body, 'Reply', 6000), requestId = uuid(input.requestId);
  return supportTransaction(data => {
    const ticket = authorizedTicket(data, id, token);
    const duplicate = ticket.messages.find(m => m.requestId === requestId);
    if (duplicate) { if (duplicate.author !== 'customer' || duplicate.body !== body) throw new SupportError('Reply identifier already used.', 409); return publicView(ticket); }
    requireVersion(input.version, ticket.version);
    if (ticket.messages.length >= 300) throw new SupportError('This ticket has reached its message limit. Open a new ticket and quote this reference.');
    const now = new Date().toISOString();
    ticket.messages.push({ id: randomUUID(), requestId, author: 'customer', authorName: 'Customer', visibility: 'public', body, createdAt: now });
    if (ticket.status === 'resolved' || ticket.status === 'closed' || ticket.status === 'waiting_customer') { ticket.status = 'open'; delete ticket.closedAt; ticket.resolution = ''; }
    ticket.updatedAt = now; ticket.version++;
    audit(data, 'customer', 'ticket.reply', id);
    return publicView(ticket);
  });
}

export async function updateTicket(actor: string, value: unknown): Promise<AdminTicket> {
  const input = inputObject(value);
  return supportTransaction(data => {
    const ticket = data.tickets.find(t => t.id === input.id);
    if (!ticket) throw new SupportError('Ticket not found.', 404);
    if (input.action === 'message') {
      const body = text(input.body, 'Message', 6000), requestId = uuid(input.requestId), visibility = choice(input.visibility, ['public', 'internal'] as const);
      const duplicate = ticket.messages.find(m => m.requestId === requestId);
      if (duplicate) { if (duplicate.author !== 'admin' || duplicate.body !== body || duplicate.visibility !== visibility) throw new SupportError('Message identifier already used.', 409); return adminView(ticket); }
      requireVersion(input.version, ticket.version);
      if (ticket.messages.length >= 300) throw new SupportError('Ticket message limit reached.');
      const now = new Date().toISOString();
      ticket.messages.push({ id: randomUUID(), requestId, author: 'admin', authorName: actor, visibility, body, createdAt: now });
      if (visibility === 'public') { ticket.firstResponseAt ??= now; if (ticket.status === 'open') ticket.status = 'waiting_customer'; }
      ticket.updatedAt = now; ticket.version++;
      audit(data, actor, visibility === 'public' ? 'ticket.public_reply' : 'ticket.internal_note', ticket.id);
      return adminView(ticket);
    }
    requireVersion(input.version, ticket.version);
    const nextStatus = choice(input.status, TICKET_STATUSES), nextPriority = choice(input.priority, PRIORITIES);
    const assignee = text(input.assignee, 'Assignee', 80, false), resolution = text(input.resolution, 'Resolution', 2000, false);
    if ((nextStatus === 'resolved' || nextStatus === 'closed') && resolution.length < 10) throw new SupportError('Add a customer-visible resolution of at least 10 characters before resolving or closing.');
    const recoveryOutcome = choice(input.recoveryOutcome, RECOVERY_OUTCOMES);
    if (ticket.category !== 'recovery' && recoveryOutcome !== 'not_reviewed') throw new SupportError('Recovery outcomes apply only to recovery tickets.');
    ticket.status = nextStatus; ticket.priority = nextPriority; ticket.assignee = assignee; ticket.resolution = resolution; ticket.recoveryOutcome = recoveryOutcome;
    ticket.dueAt = new Date(Date.parse(ticket.createdAt) + RESPONSE_HOURS[nextPriority] * 3600000).toISOString();
    if (nextStatus === 'closed') ticket.closedAt ??= new Date().toISOString(); else delete ticket.closedAt;
    ticket.updatedAt = new Date().toISOString(); ticket.version++;
    audit(data, actor, 'ticket.updated', ticket.id, ['status', 'priority', 'assignee', 'resolution', 'recoveryOutcome']);
    return adminView(ticket);
  });
}

function newBug(title: string, priority: Priority): Bug {
  const now = new Date().toISOString();
  return { id: `bug_${randomUUID()}`, title, status: 'new', priority, assignee: '', route: '', operation: '', occurrences: 0, references: [], ticketIds: [], reproduction: '', expected: '', actual: '', fixSummary: '', verification: '', changeUrl: '', createdAt: now, updatedAt: now, lastSeenAt: now, version: 1 };
}
export async function createOrLinkBug(actor: string, value: unknown) {
  const input = inputObject(value);
  return supportTransaction(data => {
    const ticket = typeof input.ticketId === 'string' ? data.tickets.find(t => t.id === input.ticketId) : undefined;
    if (input.ticketId && !ticket) throw new SupportError('Ticket not found.', 404);
    if (ticket) requireVersion(input.version, ticket.version);
    if (ticket?.bugId) throw new SupportError('This ticket is already linked to a bug.', 409);
    let bug = input.bugId ? data.bugs.find(b => b.id === input.bugId) : undefined;
    if (input.bugId && !bug) throw new SupportError('Bug not found.', 404);
    if (!bug) { if (data.bugs.length >= 10000) throw new SupportError('Bug storage is at capacity.', 503); bug = newBug(text(input.title, 'Bug title', 160), ticket?.priority ?? 'normal'); data.bugs.push(bug); }
    if (ticket) { bug.ticketIds.push(ticket.id); ticket.bugId = bug.id; ticket.status = 'waiting_engineering'; ticket.updatedAt = new Date().toISOString(); ticket.version++; bug.version++; }
    audit(data, actor, ticket ? 'bug.linked' : 'bug.created', bug.id, ticket ? [ticket.id] : []);
    return bug;
  });
}
export async function updateBug(actor: string, value: unknown) {
  const input = inputObject(value);
  return supportTransaction(data => {
    const bug = data.bugs.find(b => b.id === input.id);
    if (!bug) throw new SupportError('Bug not found.', 404);
    requireVersion(input.version, bug.version);
    const status = choice(input.status, BUG_STATUSES);
    const patch = { title: text(input.title, 'Title', 160), priority: choice(input.priority, PRIORITIES), assignee: text(input.assignee, 'Assignee', 80, false), reproduction: text(input.reproduction, 'Reproduction steps', 5000, false), expected: text(input.expected, 'Expected behavior', 2000, false), actual: text(input.actual, 'Actual behavior', 2000, false), fixSummary: text(input.fixSummary, 'Fix summary', 3000, false), verification: text(input.verification, 'Verification evidence', 3000, false), changeUrl: text(input.changeUrl, 'Change link', 500, false) };
    if (patch.changeUrl) { try { const url = new URL(patch.changeUrl); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); } catch { throw new SupportError('Use a public HTTPS change or release link without credentials.'); } }
    if (status === 'resolved' && (patch.fixSummary.length < 10 || patch.verification.length < 10)) throw new SupportError('A resolved bug needs both a fix summary and verification evidence.');
    Object.assign(bug, patch, { status, updatedAt: new Date().toISOString(), version: bug.version + 1 });
    audit(data, actor, 'bug.updated', bug.id, ['status', ...Object.keys(patch)]);
    return bug;
  });
}

export async function syncErrorReports(actor: string) {
  const reports = (await getErrorReports()).slice(0, 1000).reverse();
  return supportTransaction(data => {
    data.ingestedErrorIds ??= [];
    let count = 0;
    for (const report of reports) {
      if (data.ingestedErrorIds.includes(report.reference)) continue;
      const title = safeDiagnostic(report.message, 160) || 'Unspecified application error';
      const route = diagnosticPath(report.route), operation = safeDiagnostic(report.operation, 100);
      const fingerprint = createHash('sha256').update(`${title.replace(/\b\d+\b/g, '#')}|${route}|${operation}`).digest('hex');
      let bug = data.bugs.find(b => b.fingerprint === fingerprint);
      if (!bug) { if (data.bugs.length >= 10000) break; bug = { ...newBug(title, 'normal'), fingerprint, route, operation }; data.bugs.push(bug); }
      bug.occurrences++; bug.references = [...bug.references, report.reference].slice(-20); bug.lastSeenAt = report.created_at; bug.updatedAt = new Date().toISOString(); bug.version++;
      if (bug.status === 'resolved') { bug.status = 'investigating'; audit(data, actor, 'bug.recurred', bug.id); }
      data.ingestedErrorIds.push(report.reference); count++;
    }
    data.ingestedErrorIds = data.ingestedErrorIds.slice(-20000);
    if (count) audit(data, actor, 'errors.imported', 'bugs', [`${count} reports`]);
    return { count };
  });
}
export async function getWorkspace(): Promise<Workspace> {
  return supportTransaction(data => ({ tickets: data.tickets.map(adminView).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), bugs: [...data.bugs].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)), audit: data.audit.slice(-500).reverse(), storageReady: supportStorageReady(), recoveryAvailable: accountRecoveryAvailable(), generatedAt: new Date().toISOString() }));
}
export async function applyRetention(actor: string) {
  return supportTransaction(data => {
    const before = data.tickets.length;
    data.tickets = data.tickets.filter(t => !(t.status === 'closed' && t.closedAt && Date.now() - Date.parse(t.closedAt) > 90 * 86400000));
    const ids = new Set(data.tickets.map(t => t.id));
    for (const bug of data.bugs) bug.ticketIds = bug.ticketIds.filter(id => ids.has(id));
    data.audit = data.audit.filter(event => Date.now() - Date.parse(event.at) < 180 * 86400000);
    audit(data, actor, 'retention.applied', 'support', [`${before - data.tickets.length} closed tickets removed`]);
    return { removed: before - data.tickets.length };
  });
}
