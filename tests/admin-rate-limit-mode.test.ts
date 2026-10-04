import { afterEach, describe, expect, test, vi } from 'vitest';
import { adminLoginRateLimitBypassed } from '@/lib/server/support/auth';

afterEach(() => vi.unstubAllEnvs());
describe('admin login development throttle override', () => {
  test.each([
    ['development', 'demo', 'true', true],
    ['development', 'test', 'true', true],
    ['development', 'demo', 'false', false],
    ['development', 'demo', undefined, false],
    ['development', 'live', 'true', false],
    ['production', 'demo', 'true', false],
    ['production', 'live', 'true', false],
    ['test', 'test', 'true', false]
  ])('%s / %s / %s => %s', (nodeEnv, zikEnv, flag, expected) => {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.stubEnv('ZIK_ENV', zikEnv);
    vi.stubEnv('ZIK_DEV_BYPASS_ADMIN_RATE_LIMIT', flag);
    expect(adminLoginRateLimitBypassed()).toBe(expected);
  });
});
