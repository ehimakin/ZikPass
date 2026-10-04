import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setStoreAccessCode } from '@/lib/server/store-access';
import { createOperatorSession, readOperatorSession, verifyStoreLoginCode } from '@/lib/server/operator-session';
import { POST } from '@/app/api/partners/store-access/route';
import { ADMIN_COOKIE, hashAdminPassword, loginAdmin } from '@/lib/server/support/auth';
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'zik-store-access-'));
  vi.stubEnv('ZIK_RUNTIME_DATA_DIR', directory);
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
test('store codes are hashed, scoped, and replace fallback codes; rotation revokes sessions', async () => {
  const store = 'zik-london-001';
  const legacy = await createOperatorSession(store);
  await setStoreAccessCode(store, '462819', 'owner');
  expect(await verifyStoreLoginCode(store, '462819')).toBe(true);
  expect(await verifyStoreLoginCode(store, '8640')).toBe(false);
  expect(await verifyStoreLoginCode('zik-london-002', '462819')).toBe(false);
  expect(await readOperatorSession(legacy.token)).toBeNull();
  const session = await createOperatorSession(store);
  expect((await readOperatorSession(session.token))?.storeId).toBe(store);
  const disk = await readFile(path.join(directory, 'support-store.json'), 'utf8');
  expect(disk).not.toContain('462819');
  await setStoreAccessCode(store, '728193', 'owner');
  expect(await readOperatorSession(session.token)).toBeNull();
  expect(await verifyStoreLoginCode(store, '462819')).toBe(false);
  expect(await verifyStoreLoginCode(store, '728193')).toBe(true);
});
test('rejects invalid store IDs and codes', async () => {
  await expect(setStoreAccessCode('unknown', '462819', 'owner')).rejects.toThrow('valid store');
  await expect(setStoreAccessCode('zik-london-001', '1234', 'owner')).rejects.toThrow('six-digit');
});
test('setup requires admin session, origin and CSRF', async () => {
  const send = (headers: Record<string, string>) => POST(new NextRequest('http://localhost/api/partners/store-access', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ storeId: 'zik-london-001', code: '462819' }) }));
  expect((await send({ origin: 'http://localhost' })).status).toBe(401);
  vi.stubEnv('ZIK_ADMIN_USERNAME', 'owner');
  vi.stubEnv('ZIK_ADMIN_PASSWORD_HASH', await hashAdminPassword('a unique setup test password'));
  const session = await loginAdmin('owner', 'a unique setup test password', 'setup-test');
  const cookie = `${ADMIN_COOKIE}=${session.token}`;
  expect((await send({ cookie, origin: 'http://localhost' })).status).toBe(403);
  expect((await send({ cookie, origin: 'https://other.test', 'x-csrf-token': session.csrf })).status).toBe(403);
  expect((await send({ cookie, origin: 'http://localhost', 'x-csrf-token': session.csrf })).status).toBe(200);
});
