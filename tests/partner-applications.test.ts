import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { createPartnerApplication, readPartnerApplication, updatePartnerApplication } from '@/lib/server/partner-applications';
import { emptyApplication } from '@/lib/shared/partners/application';
let folder: string;
const details = { ...emptyApplication, storeName: 'Example test store', address: 'Example test street', storeType: 'Convenience store', contactName: 'Test Applicant', email: 'partner@example.test', role: 'Owner', consent: true, authority: true };
beforeEach(() => { folder = mkdtempSync(join(tmpdir(), 'zik-partner-test-')); vi.stubEnv('ZIK_RUNTIME_DATA_DIR', folder); vi.stubEnv('NODE_ENV', 'test'); });
afterEach(() => { rmSync(folder, { recursive: true, force: true }); vi.unstubAllEnvs(); });
describe('partner applications', () => {
  it('persists a separate application, hashes access and handles retries without duplicates', () => {
    const key = randomBytes(32).toString('base64url'); const requestId = randomUUID();
    const app = createPartnerApplication(details, requestId, key, 'test');
    expect(createPartnerApplication(details, requestId, key, 'test').id).toBe(app.id);
    expect(readPartnerApplication(app.id, key).details.email).toBe(details.email);
    const saved = readFileSync(join(folder, 'partner-applications.json'), 'utf8');
    expect(saved).not.toContain(key);
    expect(JSON.parse(saved).applications).toHaveLength(1);
    expect(() => readPartnerApplication(app.id, randomBytes(32).toString('base64url'))).toThrow('invalid or expired');
    expect(() => createPartnerApplication({ ...details, storeName: 'Changed' }, requestId, key, 'test')).toThrow('different details');
  });
  it('enforces review before setup and derives readiness from all tasks', () => {
    const key = randomBytes(32).toString('base64url'); const app = createPartnerApplication(details, randomUUID(), key, 'test');
    expect(() => updatePartnerApplication(app.id, key, 'task', 'contact', true)).toThrow('review');
    expect(updatePartnerApplication(app.id, key, 'simulate_review', undefined, undefined).status).toBe('setup');
    for (const task of ['contact', 'training', 'counter']) updatePartnerApplication(app.id, key, 'task', task, true);
    expect(readPartnerApplication(app.id, key).status).toBe('ready');
    expect(updatePartnerApplication(app.id, key, 'task', 'training', false).status).toBe('setup');
    expect(() => updatePartnerApplication(app.id, key, 'activate', undefined, undefined)).toThrow('Unknown');
    expect(() => updatePartnerApplication(app.id, key, 'task', '__proto__', true)).toThrow('Invalid');
  });
  it('rejects invalid data, missing authority/consent and service names', () => {
    for (const change of [{ email: 'bad' }, { authority: false }, { consent: false }, { services: [] }, { services: ['toString'] }, { storeName: 'password=secret' }]) {
      expect(() => createPartnerApplication({ ...details, ...change }, randomUUID(), randomBytes(32).toString('base64url'), 'test')).toThrow();
    }
  });
  it('limits new applications and fails closed in production', () => {
    for (let i = 0; i < 5; i++) createPartnerApplication(details, randomUUID(), randomBytes(32).toString('base64url'), 'test');
    expect(() => createPartnerApplication(details, randomUUID(), randomBytes(32).toString('base64url'), 'test')).toThrow('Too many');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => createPartnerApplication(details, randomUUID(), randomBytes(32).toString('base64url'), 'other')).toThrow('unavailable');
  });
});

it('API enforces origin and bearer access without creating a support ticket', async () => {
  const { NextRequest } = await import('next/server');
  const { POST, GET } = await import('@/app/api/partners/applications/route');
  const key = randomBytes(32).toString('base64url');
  const body = JSON.stringify({ action: 'create', requestId: randomUUID(), details });
  const request = (origin: string) => new NextRequest('http://localhost/api/partners/applications', { method: 'POST', headers: { origin, authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body });
  expect((await POST(request('https://untrusted.example'))).status).toBe(403);
  const response = await POST(request('http://localhost'));
  expect(response.status).toBe(201);
  const { application } = await response.json();
  expect((await GET(new NextRequest(`http://localhost/api/partners/applications?id=${application.id}`))).status).toBe(401);
  const read = await GET(new NextRequest(`http://localhost/api/partners/applications?id=${application.id}`, { headers: { authorization: `Bearer ${key}` } }));
  expect(read.status).toBe(200);
  expect(read.headers.get('cache-control')).toBe('no-store');
});
