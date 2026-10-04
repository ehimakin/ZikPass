import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getRuntimeDataDir } from '@/lib/server/runtime-paths';
import type { AuditEvent, Bug, Ticket } from '@/lib/shared/support/model';
export type AdminSession = { tokenHash: string; csrf: string; actor: string; configHash: string; createdAt: number; lastSeenAt: number; expiresAt: number };
export type SupportStore = { storeAccess?: Record<string, { salt: string; hash: string; version: string }>; version: 1; ingestedErrorIds: string[]; tickets: Ticket[]; bugs: Bug[]; audit: AuditEvent[]; sessions: AdminSession[]; limits: Record<string, { count: number; until: number }> };
let queue: Promise<unknown> = Promise.resolve();
export function supportStorageReady(): boolean {
  return !((process.env.NODE_ENV === 'production' || process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || process.env.AWS_REGION) && (!process.env.ZIK_RUNTIME_DATA_DIR?.trim() || process.env.ZIK_SUPPORT_STORAGE_DURABLE !== 'true'));
}
export class SupportError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function supportTransaction<T>(work: (data: SupportStore) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    if (!supportStorageReady()) throw new SupportError('Durable support storage is not configured. Please try again later.', 503);
    const file = path.join(getRuntimeDataDir(), 'support-store.json');
    const lock = `${file}.lock`;
    await fs.mkdir(path.dirname(file), { recursive: true });
    let acquired = false;
    for (let i = 0; i < 120; i++) {
      try { await fs.mkdir(lock); acquired = true; break; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; await new Promise(resolve => setTimeout(resolve, 25)); }
    }
    if (!acquired) throw new SupportError('Support storage is busy. Please retry.', 503);
    try {
      let data: SupportStore;
      try { data = JSON.parse(await fs.readFile(file, 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; data = { version: 1, ingestedErrorIds: [], tickets: [], bugs: [], audit: [], sessions: [], limits: {} }; }
      if (data.version !== 1) throw new SupportError('Unsupported support storage version.', 503);
      const result = await work(data);
      const temporary = `${file}.${randomUUID()}.tmp`;
      try { await fs.writeFile(temporary, JSON.stringify(data), { mode: 0o600 }); await fs.rename(temporary, file); }
      finally { await fs.rm(temporary, { force: true }); }
      return result;
    } finally { await fs.rm(lock, { recursive: true, force: true }); }
  });
  queue = run.catch(() => undefined);
  return run;
}
export function audit(data: SupportStore, actor: string, action: string, target: string, changes: string[] = []) {
  data.audit.push({ id: randomUUID(), at: new Date().toISOString(), actor, action, target, changes });
}
/** Counters commit even on denial: callers throw only after this transaction returns. */
export async function supportRateLimit(key: string, limit: number, windowMs: number) {
  const allowed = await supportTransaction(data => {
    const now = Date.now();
    for (const [id, value] of Object.entries(data.limits)) if (value.until <= now) delete data.limits[id];
    if (Object.keys(data.limits).length >= 10000 && !data.limits[key]) return false;
    const value = data.limits[key] ?? { count: 0, until: now + windowMs };
    value.count++; data.limits[key] = value;
    return value.count <= limit;
  });
  if (!allowed) throw new SupportError('Too many attempts. Please wait before trying again.', 429);
}
