import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/demo/card-activation/route';
import { cardDemoAction, type CardDemoAdapter, type CardDemoData } from '@/lib/server/card-activation-demo';
import { cardDemoEnabled, parseCardSerial } from '@/lib/shared/card-activation';
const clerk = { storeId: 'zik-london-001', operator: 'clerk-session-1' };
const key = 'demo-public-key:12345678-1234-1234-1234-123456789abc';
function fixture() {
  const data: CardDemoData = { sessions: [] };
  const adapter: CardDemoAdapter = { transact: async fn => fn(data) };
  const act = (input: Parameters<typeof cardDemoAction>[0], actor: typeof clerk | undefined = clerk, now = 1000) => cardDemoAction(input, actor, adapter, now);
  return { data, act };
}
afterEach(() => vi.unstubAllEnvs());
describe('purchased card demo', () => {
  it('validates public serials and rejects URLs and unknown cards', async () => {
    expect(parseCardSerial('ZIKCARD:1:ZKC-DEMO-000001')).toBe('ZKC-DEMO-000001');
    expect(() => parseCardSerial('https://example.com/ZKC-DEMO-000001')).toThrow('Invalid');
    const { act } = fixture();
    await expect(act({ action: 'start', serial: 'ZKC-DEMO-123456' })).rejects.toThrow('Unknown');
    await expect(act({ action: 'start', serial: 'ZKC-DEMO-999998' })).rejects.toThrow('already activated');
    await expect(act({ action: 'start', serial: 'ZKC-DEMO-999999' })).rejects.toThrow('unavailable');
  });
  it('enforces placeholder, QR, pairing and explicit customer binding in order', async () => {
    const { act, data } = fixture();
    const s = await act({ action: 'start', serial: 'ZKC-DEMO-000001' });
    expect(s.stage).toBe('additional_services'); expect(s.token).toBeUndefined();
    const secret = data.sessions[0].token;
    await expect(act({ action: 'pair', token: secret, mockPublicKey: key })).rejects.toThrow('display');
    await expect(act({ action: 'customer_bind', token: secret, mockPublicKey: key })).rejects.toThrow('Pair');
    const qr = await act({ action: 'show_qr', id: s.id });
    expect(qr.token).not.toBe(s.serial); expect(qr.pairingCode).not.toBe(s.serial);
    expect((await act({ action: 'pair', token: qr.pairingCode, mockPublicKey: key })).stage).toBe('device_connected');
    expect((await act({ action: 'pair', token: qr.token, mockPublicKey: key })).stage).toBe('device_connected');
    await expect(act({ action: 'activate', id: s.id })).rejects.toThrow('Unknown action');
    expect((await act({ action: 'customer_bind', token: qr.token, mockPublicKey: key })).stage).toBe('completed');
    expect((await act({ action: 'customer_bind', token: qr.token, mockPublicKey: key })).stage).toBe('completed');
    expect((await act({ action: 'pair', token: qr.token, mockPublicKey: key })).stage).toBe('completed');
    await expect(act({ action: 'start', serial: s.serial })).rejects.toThrow('already activated');
    expect(data.sessions).toHaveLength(1);
  });
  it('resumes duplicates for the same clerk and never transfers devices', async () => {
    const { act } = fixture(); const s = await act({ action: 'start', serial: 'ZKC-DEMO-000001' });
    expect(await act({ action: 'start', serial: s.serial })).toEqual(s);
    await expect(act({ action: 'start', serial: s.serial }, { ...clerk, operator: 'other' })).rejects.toThrow('another clerk');
    const qr = await act({ action: 'show_qr', id: s.id });
    await act({ action: 'pair', token: qr.token, mockPublicKey: key });
    await expect(act({ action: 'customer_bind', token: qr.token, mockPublicKey: key.replace('abc', 'def') })).rejects.toThrow('another device');
    await expect(act({ action: 'simulate_bind', id: s.id })).rejects.toThrow('simulated');
  });
  it('requires preverified purchase state, never client assertions', async () => {
    const { act, data } = fixture(); const s = await act({ action: 'start', serial: 'ZKC-DEMO-000001' });
    const qr = await act({ action: 'show_qr', id: s.id });
    await act({ action: 'pair', token: qr.token, mockPublicKey: key });
    data.sessions[0].purchaseCheck = undefined;
    await expect(act({ action: 'customer_bind', token: qr.token, mockPublicKey: key })).rejects.toThrow('eligible purchased card');
  });
  it('expiry and cancellation prevent binding and restart with new secrets', async () => {
    for (const expired of [true, false]) {
      const { act } = fixture(); const s = await act({ action: 'start', serial: 'ZKC-DEMO-000001' });
      const qr = await act({ action: 'show_qr', id: s.id });
      await act({ action: 'pair', token: qr.token, mockPublicKey: key });
      if (!expired) await act({ action: 'cancel', id: s.id });
      const now = expired ? s.expiresAt : 1000;
      await expect(act({ action: 'customer_bind', token: qr.token, mockPublicKey: key }, clerk, now)).rejects.toThrow(expired ? 'expired' : 'cancelled');
      const next = await act({ action: 'start', serial: s.serial }, clerk, now);
      expect(next.id).not.toBe(s.id);
    }
  });
  it('simulation requires QR display and a separate explicit binding confirmation', async () => {
    const { act } = fixture(); const s = await act({ action: 'start', serial: 'ZKC-DEMO-000001' });
    await expect(act({ action: 'simulate_pair', id: s.id })).rejects.toThrow('Display');
    await act({ action: 'show_qr', id: s.id });
    expect((await act({ action: 'simulate_pair', id: s.id })).stage).toBe('device_connected');
    expect((await act({ action: 'simulate_bind', id: s.id })).stage).toBe('completed');
  });
  it('excludes production and live including all simulations', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('ZIK_ENV', 'demo');
    expect(cardDemoEnabled()).toBe(false);
    for (const action of ['start', 'show_qr', 'pair', 'customer_bind', 'simulate_pair', 'simulate_bind']) await expect(fixture().act({ action })).rejects.toThrow('unavailable');
    expect((await POST(new NextRequest('http://localhost/api/demo/card-activation', { method: 'POST', body: '{}' }))).status).toBe(404);
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('ZIK_ENV', 'live'); expect(cardDemoEnabled()).toBe(false);
  });
  it('rejects unauthenticated staff actions and cross-origin writes', async () => {
    expect((await POST(new NextRequest('http://localhost/api/demo/card-activation', { method: 'POST', body: JSON.stringify({ action: 'show_qr' }) }))).status).toBe(401);
    expect((await POST(new NextRequest('http://localhost/api/demo/card-activation', { method: 'POST', headers: { origin: 'https://untrusted.example' }, body: '{}' }))).status).toBe(403);
  });
});
