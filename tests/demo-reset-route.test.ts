import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ runtime: vi.fn(), disclosures: vi.fn(), signals: vi.fn(), demo: true }));
vi.mock('@/lib/server/storage', () => ({ resetDemoRuntimeState: mocks.runtime }));
vi.mock('@/lib/server/disclosure-service', () => ({ resetDisclosures: mocks.disclosures }));
vi.mock('@/lib/server/zik-id-sessions', () => ({ resetZikIdSignalSessions: mocks.signals }));
vi.mock('@/lib/shared/demo-environment', () => ({ get isDemoEnvironment() { return mocks.demo; } }));
vi.mock('@/lib/server/affiliate-demo-session', () => ({ AGE_REQUEST_COOKIE: 'zik-nightfall-age-request', AGE_SESSION_COOKIE: 'zik-nightfall-age-session' }));
vi.mock('@/lib/server/operator-session', () => ({ OPERATOR_SESSION_COOKIE: 'zik-operator-session' }));
import { POST } from '@/app/api/demo/reset/route';

describe('demo reset endpoint', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.demo = true; });
  it('resets current services and expires browser demo sessions', async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(mocks.runtime).toHaveBeenCalledOnce();
    expect(mocks.disclosures).toHaveBeenCalledOnce();
    expect(mocks.signals).toHaveBeenCalledOnce();
    for (const name of ['zik-nightfall-age-request', 'zik-nightfall-age-session', 'zik-operator-session', 'zikpass-pwa-handoff', 'zik-retail-pending']) {
      expect(response.cookies.get(name)).toMatchObject({ value: '', maxAge: 0 });
    }
    expect(response.cookies.get('zik-retail-pending')?.path).toBe('/api/demo-merchant');
  });
  it('does not reset anything in live mode', async () => {
    mocks.demo = false;
    const response = await POST();
    expect(response.status).toBe(403);
    expect(mocks.runtime).not.toHaveBeenCalled();
    expect(mocks.disclosures).not.toHaveBeenCalled();
    expect(mocks.signals).not.toHaveBeenCalled();
    expect(response.cookies.getAll()).toHaveLength(0);
  });
});
