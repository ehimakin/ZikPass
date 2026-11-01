import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { supportTransaction } from '@/lib/server/support/store';
import { createTicket, updateTicket, getWorkspace } from '@/lib/server/support/service';
import { processDeliveries } from '@/lib/server/support/delivery';
import { hashAdminPassword, loginAdmin, requireAdmin, ADMIN_COOKIE } from '@/lib/server/support/auth';
const callbacks = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock('next/server', async importOriginal => ({
  ...await importOriginal<typeof import('next/server')>(),
  after: vi.fn((callback: () => Promise<void>) => { callbacks.push(callback); }),
}));
let directory: string;
const fetcher = vi.fn();
const input = (optIn = true) => ({ accessKey: randomBytes(32).toString('base64url'), requestId: randomUUID(), category: 'technical', subject: 'Test issue', body: 'The screen is blank.', email: 'customer@example.test', emailNotifications: optIn });
beforeEach(async () => {
  callbacks.length = 0;
  directory = await mkdtemp(path.join(os.tmpdir(), 'zik-delivery-'));
  vi.stubEnv('ZIK_RUNTIME_DATA_DIR', directory);
  vi.stubEnv('ZIK_SUPPORT_DATABASE_URL', '');
  vi.stubEnv('ZIK_SUPPORT_NOTIFICATIONS_ENABLED', 'true');
  vi.stubEnv('RESEND_API_KEY', 'test-only');
  vi.stubEnv('ZIK_SUPPORT_FROM_EMAIL', 'support@example.test');
  vi.stubEnv('ZIK_SUPPORT_STAFF_EMAIL', 'staff@example.test');
  vi.stubEnv('ZIK_SUPPORT_STAFF_PHONE', '+447700900123');
  vi.stubEnv('TWILIO_ACCOUNT_SID', `AC${'a'.repeat(32)}`);
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'test-only');
  vi.stubEnv('TWILIO_MESSAGING_SERVICE_SID', `MG${'b'.repeat(32)}`);
  fetcher.mockReset().mockImplementation(async () => Response.json({ id: 'email-id', sid: 'sms-id' }));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); await rm(directory, { recursive: true, force: true }); });
const deliveries = () => supportTransaction(data => data.deliveries ?? []);
async function reply(id: string, version: number, visibility = 'public') {
  const request = { id, version, action: 'message', requestId: randomUUID(), body: 'This is a private support message.', visibility };
  await updateTicket('staff', request); return request;
}
describe('support notification outbox', () => {
  it('dispatches after commit without holding up the ticket response, with no duplicate scheduling', async () => {
    const request = input();
    const ticket = await createTicket(request);
    expect(fetcher).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);
    expect((await getWorkspace()).tickets[0].id).toBe(ticket.id);
    await createTicket(request);
    expect(callbacks).toHaveLength(1);
    await callbacks.shift()!();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await reply(ticket.id, 1, 'internal');
    expect(callbacks).toHaveLength(0);
    await reply(ticket.id, 2);
    expect(callbacks).toHaveLength(1);
    await callbacks.shift()!();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('imports new errors and alerts staff after the response without recursive scheduling', async () => {
    const { reportError } = await import('@/lib/server/error-reports');
    await reportError({ message: 'An event-triggered test error', route: '/test' });
    expect(callbacks).toHaveLength(1);
    expect(fetcher).not.toHaveBeenCalled();
    await callbacks.shift()!();
    expect((await getWorkspace()).bugs).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(0);
  });
  it('prioritizes a new event ahead of a pre-existing backlog', async () => {
    for (let i = 0; i < 6; i++) await createTicket(input());
    const rows = await deliveries();
    await processDeliveries([rows[5].id]);
    expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe(rows[5].id);
  });
  it('retries definite rate-limit rejections on the daily run even after 24 hours', async () => {
    await createTicket(input());
    fetcher.mockResolvedValueOnce(new Response('', { status: 429 }));
    await processDeliveries();
    await supportTransaction(data => { Object.assign(data.deliveries![0], { nextAttemptAt: 0, firstAttemptAt: Date.now() - 26 * 3600000 }); });
    await processDeliveries();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await deliveries())[0].status).toBe('accepted');
  });

  it('queues once, keeps private content out and never alerts for internal notes', async () => {
    const request = input(); const ticket = await createTicket(request);
    await createTicket(request);
    expect(await deliveries()).toHaveLength(1);
    await reply(ticket.id, 1, 'internal');
    expect(await deliveries()).toHaveLength(1);
    const publicReply = await reply(ticket.id, 2);
    await updateTicket('staff', publicReply);
    expect(await deliveries()).toHaveLength(2);
    expect(JSON.stringify(await deliveries())).not.toContain('private support message');
    expect(JSON.stringify(await deliveries())).not.toContain(request.accessKey);
    await processDeliveries();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await deliveries()).every(d => d.status === 'accepted')).toBe(true);
    await processDeliveries(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('requires customer opt-in and never sends messages when disabled', async () => {
    const ticket = await createTicket(input(false)); await reply(ticket.id, 1);
    expect(await deliveries()).toHaveLength(1);
    vi.stubEnv('ZIK_SUPPORT_NOTIFICATIONS_ENABLED', 'false');
    await createTicket(input()); await processDeliveries();
    expect(fetcher).not.toHaveBeenCalled(); expect(await deliveries()).toHaveLength(1);
  });
  it('retries Resend with the same idempotency key and coordinates concurrent workers', async () => {
    await createTicket(input());
    fetcher.mockResolvedValueOnce(new Response('', { status: 429 }));
    await processDeliveries();
    const first = (await deliveries())[0]; expect(first.status).toBe('pending');
    await supportTransaction(data => { data.deliveries![0].nextAttemptAt = 0; });
    await Promise.all([processDeliveries(), processDeliveries()]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe(fetcher.mock.calls[1][1].headers['Idempotency-Key']);
    expect((await deliveries())[0].status).toBe('accepted');
  });
  it('sends urgent staff SMS through a messaging service without retrying ambiguous failures', async () => {
    await createTicket({ ...input(), category: 'privacy' });
    fetcher.mockImplementation(async (url: string) => { if (url.includes('twilio')) throw new Error('timeout'); return Response.json({ id: 'email-id' }); });
    await processDeliveries();
    const sms = (await deliveries()).find(d => d.channel === 'sms')!;
    expect(sms.status).toBe('uncertain');
    const call = fetcher.mock.calls.find(c => c[0].includes('twilio'))!;
    expect(new URLSearchParams(call[1].body).get('MessagingServiceSid')).toBe(`MG${'b'.repeat(32)}`);
    await processDeliveries(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not retry email after the provider idempotency window expires', async () => {
    await createTicket(input());
    await supportTransaction(data => { Object.assign(data.deliveries![0], { attempts: 1, createdAt: new Date(Date.now() - 25 * 3600000).toISOString() }); });
    await processDeliveries(); expect(fetcher).not.toHaveBeenCalled();
    expect((await deliveries())[0].status).toBe('uncertain');
  });
  it('keeps provider errors out of ticket data and credentials out of dashboard status', async () => {
    const ticket = await createTicket(input());
    fetcher.mockResolvedValue(new Response('sensitive provider body', { status: 400 }));
    await processDeliveries();
    expect((await getWorkspace()).tickets[0].id).toBe(ticket.id);
    expect(JSON.stringify(await getWorkspace())).not.toContain('sensitive provider body');
    expect((await getWorkspace()).notifications?.failed).toBe(1);
  });
  it('fails closed for cron without its secret', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { GET } = await import('@/app/api/cron/support/route');
    expect((await GET(new NextRequest('https://example.test/api/cron/support'))).status).toBe(401);
  });
  it('supports named staff and restricts administrative operations', async () => {
    const password = 'a sufficiently long staff password';
    vi.stubEnv('ZIK_STAFF_ACCOUNTS', JSON.stringify([{ username: 'engineer', passwordHash: await hashAdminPassword(password), role: 'engineer' }]));
    const sessionRoute = await import('@/app/api/admin/session/route');
    const response = await sessionRoute.POST(new NextRequest('https://example.test/api/admin/session', { method: 'POST', headers: { origin: 'https://example.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'engineer', password }) }));
    expect((await response.json()).role).toBe('engineer');
    const session = await loginAdmin('engineer', password, '127.0.0.1');
    const headers = { cookie: `${ADMIN_COOKIE}=${session.token}`, origin: 'https://example.test', 'x-csrf-token': session.csrf, 'Content-Type': 'application/json' };
    expect((await requireAdmin(new NextRequest('https://example.test/api/admin/workspace', { headers }))).role).toBe('engineer');
    const { POST } = await import('@/app/api/admin/workspace/route');
    expect((await POST(new NextRequest('https://example.test/api/admin/workspace', { method: 'POST', headers, body: JSON.stringify({ action: 'send_notifications' }) }))).status).toBe(403);
    vi.stubEnv('ZIK_STAFF_ACCOUNTS', '[]');
    await expect(requireAdmin(new NextRequest('https://example.test/api/admin/workspace', { headers }))).rejects.toMatchObject({ status: 401 });
  });
});
