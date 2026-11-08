import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { getRuntimeDataDir } from './runtime-paths';
import { applicationIssue, SETUP_TASKS, type ApplicationInput, type PartnerApplication, type SetupTask } from '@/lib/shared/partners/application';
import { containsSupportSecret } from '@/lib/shared/support/validation';
export class PartnerError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const partnerPrototypeEnabled = () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
type RecordRow = { application: PartnerApplication; accessHash: string; requestId: string; inputHash: string; expiresAt: number };
type Store = { applications: RecordRow[]; limits: Record<string, { count: number; until: number }> };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function transaction<T>(fn: (store: Store) => T): T {
  if (!partnerPrototypeEnabled()) throw new PartnerError('Partner application prototype is unavailable outside development.', 404);
  const folder = getRuntimeDataDir(); mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'partner-applications.json');
  const lock = `${file}.lock`;
  try { mkdirSync(lock); } catch { throw new PartnerError('Applications are busy. Please try again.', 503); }
  try {
    const store: Store = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { applications: [], limits: {} };
    const result = fn(store);
    const temporary = `${file}.${randomUUID()}.tmp`;
    try { writeFileSync(temporary, JSON.stringify(store), { mode: 0o600 }); renameSync(temporary, file); }
    finally { rmSync(temporary, { force: true }); }
    return result;
  } finally { rmSync(lock, { recursive: true, force: true }); }
}
function validate(raw: unknown): ApplicationInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PartnerError('Enter your application details.');
  const value = raw as Record<string, unknown>;
  const fields = ['storeName', 'address', 'storeType', 'googlePlaceId', 'contactName', 'email', 'role'] as const;
  for (const field of fields) if (typeof value[field] !== 'string') throw new PartnerError('Invalid application details.');
  if (!Array.isArray(value.services) || value.services.some(s => typeof s !== 'string')) throw new PartnerError('Choose your services.');
  const input = Object.fromEntries(fields.map(field => [field, (value[field] as string).trim()])) as Omit<ApplicationInput, 'services' | 'consent' | 'authority'>;
  const details: ApplicationInput = { ...input, services: [...new Set(value.services)] as ApplicationInput['services'], consent: value.consent === true, authority: value.authority === true };
  const issue = applicationIssue(details); if (issue) throw new PartnerError(issue);
  if (fields.some(field => containsSupportSecret(details[field]))) throw new PartnerError('Remove passwords, recovery phrases and private keys before sending.');
  return details;
}
function authorize(store: Store, id: string, key: string) {
  const row = store.applications.find(row => row.application.id === id);
  if (!row || !/^[A-Za-z0-9_-]{43}$/.test(key) || !timingSafeEqual(Buffer.from(row.accessHash), Buffer.from(hash(key))) || row.expiresAt <= Date.now()) throw new PartnerError('This application session is invalid or expired. Return to the browser tab where you applied.', 401);
  return row;
}
export function createPartnerApplication(raw: unknown, requestId: string, key: string, client: string) {
  const details = validate(raw);
  if (!/^[a-f0-9-]{36}$/.test(requestId) || !/^[A-Za-z0-9_-]{43}$/.test(key)) throw new PartnerError('Invalid application request.');
  return transaction(store => {
    const existing = store.applications.find(row => row.requestId === requestId);
    const inputHash = hash(JSON.stringify(details));
    if (existing) {
      authorize(store, existing.application.id, key);
      if (existing.inputHash !== inputHash) throw new PartnerError('This request was already submitted with different details. Resume your application.', 409);
      return existing.application;
    }
    const now = Date.now();
    for (const [id, limit] of Object.entries(store.limits)) if (limit.until <= now) delete store.limits[id];
    const bucket = hash(client); const limit = store.limits[bucket] ?? { count: 0, until: now + 3600000 };
    if (limit.count >= 5 || Object.keys(store.limits).length >= 10000) throw new PartnerError('Too many applications. Please try again later.', 429);
    limit.count++; store.limits[bucket] = limit;
    const application: PartnerApplication = { id: `partner_${randomUUID()}`, details, status: 'submitted', completedTasks: [], createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
    store.applications.push({ application, requestId, inputHash, accessHash: hash(key), expiresAt: now + 30 * 86400000 });
    return application;
  });
}
export function readPartnerApplication(id: string, key: string) { return transaction(store => authorize(store, id, key).application); }
export function updatePartnerApplication(id: string, key: string, action: unknown, task: unknown, complete: unknown) {
  return transaction(store => {
    const app = authorize(store, id, key).application;
    if (action === 'simulate_review') {
      if (app.status === 'submitted') app.status = 'setup';
    } else if (action === 'task') {
      if (app.status === 'submitted') throw new PartnerError('Complete the demo review before starting setup.', 409);
      if (typeof task !== 'string' || !Object.hasOwn(SETUP_TASKS, task) || typeof complete !== 'boolean') throw new PartnerError('Invalid setup task.');
      const tasks = new Set(app.completedTasks);
      if (complete) tasks.add(task as SetupTask); else tasks.delete(task as SetupTask);
      app.completedTasks = [...tasks];
      app.status = tasks.size === Object.keys(SETUP_TASKS).length ? 'ready' : 'setup';
    } else throw new PartnerError('Unknown application action.');
    app.updatedAt = new Date().toISOString();
    return app;
  });
}
