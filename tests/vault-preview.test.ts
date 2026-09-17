import { afterEach, expect, it, vi } from 'vitest';
import { validateMockVaultKey } from '../lib/client/vault-preview';

afterEach(() => vi.unstubAllEnvs());
it.each(['production', 'test'])('rejects the development key in %s', async environment => {
  vi.stubEnv('NODE_ENV', environment);
  expect(await validateMockVaultKey('memaguy', new AbortController().signal)).toBe('failure');
});
it('opens the demo only with the exact development key', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  expect(await validateMockVaultKey('memaguy', new AbortController().signal)).toBe('demo');
  expect(await validateMockVaultKey('MEMAGUY', new AbortController().signal)).toBe('failure');
});
