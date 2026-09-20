import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { containsSupportSecret } from '@/lib/shared/support/validation';
import { generateRecoveryPhrase } from '@/lib/shared/account-recovery/crypto';

let directory: string;
let auth: typeof import('@/lib/server/support/auth');
let store: typeof import('@/lib/server/support/store');
let service: typeof import('@/lib/server/support/service');
let passwordHash: string;
const password = 'a unique test-only admin password';
const token = () => randomBytes(32).toString('base64url');
async function create(category = 'technical') {
  const accessKey = token(), requestId = randomUUID();
  const input = { accessKey, requestId, category, subject: 'Cannot open the pass', body: 'The pass screen is blank after loading.', email: 'person@example.test' };
  const ticket = await service.createTicket(input);
  return { accessKey, input, ticket };
}
beforeAll(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'zik-support-test-'));
  vi.stubEnv('ZIK_RUNTIME_DATA_DIR', directory); vi.stubEnv('ZIK_ADMIN_USERNAME', 'owner'); vi.stubEnv('ZIK_SUPPORT_STORAGE_DURABLE', 'true');
  vi.resetModules(); auth = await import('@/lib/server/support/auth'); store = await import('@/lib/server/support/store'); service = await import('@/lib/server/support/service');
  passwordHash = await auth.hashAdminPassword(password); vi.stubEnv('ZIK_ADMIN_PASSWORD_HASH', passwordHash);
});
beforeEach(async () => {
  vi.useRealTimers(); vi.stubEnv('ZIK_ADMIN_PASSWORD_HASH', passwordHash);
  await rm(path.join(directory, 'support-store.json'), { force: true });
  const runtime = await import('@/lib/server/storage'); await runtime.resetDemoRuntimeState();
});
afterAll(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.resetModules(); await rm(directory, { recursive: true, force: true }); });

describe('owner authentication and admin API', () => {
  it('has no default login, stores no plaintext credentials, expires and revokes sessions', async () => {
    vi.stubEnv('ZIK_ADMIN_PASSWORD_HASH', '');
    await expect(auth.loginAdmin('owner', password, 'ip')).rejects.toThrow('not configured');
    vi.stubEnv('ZIK_ADMIN_PASSWORD_HASH', passwordHash);
    await expect(auth.loginAdmin('owner', '8640', 'ip')).rejects.toThrow('not recognised');
    const session = await auth.loginAdmin('owner', password, 'ip');
    expect((await auth.readAdminSession(session.token))?.actor).toBe('owner');
    const disk = await readFile(path.join(directory, 'support-store.json'), 'utf8');
    expect(disk).not.toContain(password); expect(disk).not.toContain(session.token);
    await auth.logoutAdmin(session.token); expect(await auth.readAdminSession(session.token)).toBeNull();
    const next = await auth.loginAdmin('owner', password, 'ip');
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.now() + 31 * 60_000);
    expect(await auth.readAdminSession(next.token)).toBeNull(); vi.useRealTimers();
    const rotated = await auth.loginAdmin('owner', password, 'ip');
    vi.stubEnv('ZIK_ADMIN_PASSWORD_HASH', await auth.hashAdminPassword('another unique test-only password'));
    expect(await auth.readAdminSession(rotated.token)).toBeNull();
  });
  it('rate-limits failed logins durably without losing counters on rejection', async () => {
    for (let i = 0; i < 5; i++) await expect(auth.loginAdmin('owner', 'incorrect', 'same-ip')).rejects.toThrow('not recognised');
    await expect(auth.loginAdmin('owner', password, 'same-ip')).rejects.toMatchObject({ status: 429 });
  });
  it('requires admin identity, exact origin and CSRF for mutations; clerk cookies are not admin', async () => {
    const route = await import('@/app/api/admin/workspace/route');
    expect((await route.GET(new NextRequest('http://localhost/api/admin/workspace'))).status).toBe(401);
    const session = await auth.loginAdmin('owner', password, 'ip');
    const send = (headers: Record<string, string>) => route.POST(new NextRequest('http://localhost/api/admin/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action: 'create_bug', title: 'Test engineering issue' }) }));
    expect((await send({ cookie: 'zik-operator-session=clerk', origin: 'http://localhost' })).status).toBe(401);
    const cookie = `${auth.ADMIN_COOKIE}=${session.token}`;
    expect((await send({ cookie, origin: 'http://localhost' })).status).toBe(403);
    expect((await send({ cookie, origin: 'https://other.test', 'x-csrf-token': session.csrf })).status).toBe(403);
    expect((await send({ cookie, origin: 'http://localhost', 'x-csrf-token': session.csrf })).status).toBe(200);
    const errors = await import('@/app/api/errors/route');
    expect((await errors.GET(new NextRequest('http://localhost/api/errors'))).status).toBe(401);
    const issuer = await import('@/app/api/issuer/sessions/route');
    expect((await issuer.GET(new NextRequest('http://localhost/api/issuer/sessions'))).status).toBe(401);
  });
});

describe('ticket privacy, retries and workflow', () => {
  it('requires the private key, deduplicates creation, and never exposes internal notes or email', async () => {
    const { ticket, input, accessKey } = await create();
    expect((await service.createTicket(input)).id).toBe(ticket.id);
    await expect(service.readCustomerTicket(ticket.id, token())).rejects.toMatchObject({ status: 404 });
    await expect(service.createTicket({ ...input, accessKey: token() })).rejects.toMatchObject({ status: 409 });
    const note = await service.updateTicket('owner', { id: ticket.id, action: 'message', version: 1, requestId: randomUUID(), visibility: 'internal', body: 'Internal engineering discussion only.' });
    expect(note.firstResponseAt).toBeUndefined();
    const publicTicket = await service.readCustomerTicket(ticket.id, accessKey);
    expect(publicTicket.messages).toHaveLength(1);
    expect(JSON.stringify(publicTicket)).not.toContain('Internal engineering');
    expect(publicTicket).not.toHaveProperty('contactEmail'); expect(publicTicket).not.toHaveProperty('accessHash');
    expect(JSON.stringify(await service.getWorkspace())).not.toContain(accessKey);
    expect(await readFile(path.join(directory, 'support-store.json'), 'utf8')).not.toContain(accessKey);
  });
  it('rejects secrets before storing, including actual BIP39 phrases', async () => {
    const phrase = generateRecoveryPhrase(); expect(containsSupportSecret(phrase)).toBe(true);
    await expect(service.createTicket({ accessKey: token(), requestId: randomUUID(), category: 'recovery', subject: 'Need recovery help', body: phrase })).rejects.toThrow('Remove recovery words');
    const { ticket } = await create();
    await expect(service.updateTicket('owner', { id: ticket.id, action: 'message', version: 1, requestId: randomUUID(), visibility: 'public', body: `My passphrase: not-for-storage` })).rejects.toThrow('Remove recovery words');
    const disk = await readFile(path.join(directory, 'support-store.json'), 'utf8'); expect(disk).not.toContain(phrase);
  });
  it('deduplicates replies, rejects stale edits, requires a resolution and reopens after a customer reply', async () => {
    const { ticket, accessKey } = await create('recovery');
    const request = { action: 'message', id: ticket.id, version: 1, requestId: randomUUID(), visibility: 'public', body: 'Please use the recovery screen on your replacement device.' };
    const replied = await service.updateTicket('owner', request); expect(replied.firstResponseAt).toBeTruthy(); expect(replied.status).toBe('waiting_customer');
    expect((await service.updateTicket('owner', request)).messages).toHaveLength(2);
    const update = { id: ticket.id, action: 'update', version: replied.version, priority: 'high', assignee: 'owner', status: 'resolved', resolution: '', recoveryOutcome: 'guidance_sent' };
    await expect(service.updateTicket('owner', update)).rejects.toThrow('customer-visible resolution');
    const resolved = await service.updateTicket('owner', { ...update, resolution: 'Customer confirmed the recovery instructions worked.' });
    await expect(service.updateTicket('owner', { ...update, resolution: 'Stale resolution must not replace the current result.' })).rejects.toMatchObject({ status: 409 });
    const reply = { version: resolved.version, requestId: randomUUID(), body: 'There is still a problem after trying the steps.' };
    const reopened = await service.replyToTicket(ticket.id, accessKey, reply); expect(reopened.status).toBe('open');
    expect((await service.replyToTicket(ticket.id, accessKey, reply)).messages).toHaveLength(3);
    const audit = (await service.getWorkspace()).audit; expect(audit.some(a => a.action === 'ticket.public_reply')).toBe(true); expect(JSON.stringify(audit)).not.toContain(reply.body);
  });
  it('serializes concurrent writes so only one edit at a revision succeeds', async () => {
    const { ticket } = await create();
    const writes = [1, 2].map(n => service.updateTicket('owner', { action: 'message', id: ticket.id, version: 1, requestId: randomUUID(), visibility: 'internal', body: `Investigation note ${n}` }));
    const outcomes = await Promise.allSettled(writes); expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(1);
  });
});

describe('engineering queue and retention', () => {
  it('groups errors once, links tickets, requires fix evidence and reopens a recurring bug', async () => {
    const { reportError } = await import('@/lib/server/error-reports');
    await reportError({ message: 'Failed to fetch', route: '/vault?token=should-not-survive', operation: 'load' });
    await reportError({ message: 'Failed to fetch', route: '/vault?other=value', operation: 'load' });
    expect((await service.syncErrorReports('owner')).count).toBe(2);
    expect((await service.syncErrorReports('owner')).count).toBe(0);
    let bug = (await service.getWorkspace()).bugs[0]; expect(bug.occurrences).toBe(2); expect(bug.route).toBe('/vault');
    await expect(service.updateBug('owner', { ...bug, status: 'resolved' })).rejects.toThrow('verification evidence');
    const { ticket } = await create();
    bug = await service.createOrLinkBug('owner', { ticketId: ticket.id, version: 1, bugId: bug.id });
    expect(bug.ticketIds).toContain(ticket.id);
    bug = await service.updateBug('owner', { ...bug, status: 'resolved', fixSummary: 'Corrected the network retry handling.', verification: 'The network failure regression test passes.' });
    await reportError({ message: 'Failed to fetch', route: '/vault', operation: 'load' });
    await service.syncErrorReports('owner');
    bug = (await service.getWorkspace()).bugs[0]; expect(bug.status).toBe('investigating'); expect(bug.occurrences).toBe(3);
    await expect(service.updateBug('owner', { ...bug, changeUrl: 'javascript:alert(1)' })).rejects.toThrow('HTTPS');
  });
  it('purges only expired closed tickets and removes access, preserving open cases', async () => {
    const old = await create(), open = await create();
    await store.supportTransaction(data => { const t = data.tickets.find(t => t.id === old.ticket.id)!; t.status = 'closed'; t.closedAt = new Date(Date.now() - 91 * 86400000).toISOString(); });
    expect((await service.applyRetention('owner')).removed).toBe(1);
    await expect(service.readCustomerTicket(old.ticket.id, old.accessKey)).rejects.toMatchObject({ status: 404 });
    expect((await service.readCustomerTicket(open.ticket.id, open.accessKey)).id).toBe(open.ticket.id);
  });
  it('fails closed on production without explicitly durable storage', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('ZIK_SUPPORT_STORAGE_DURABLE', 'false');
    await expect(service.getWorkspace()).rejects.toMatchObject({ status: 503 });
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('ZIK_SUPPORT_STORAGE_DURABLE', 'true');
  });
});
