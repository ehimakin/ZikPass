/** All web/native routing decisions are kept pure and tested. No arbitrary JS bridge. */
export type WebDestination = { kind: 'native'; path: '/vault' | '/identity' | '/wallet' } | { kind: 'handoff'; token: string } | { kind: 'web'; url: string } | { kind: 'external'; url: string } | { kind: 'blocked' };
export function configuredOrigin(value: string | undefined, development: boolean): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.protocol !== 'https:' && !(development && url.protocol === 'http:' && ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}
export function webDestination(raw: string, origin: string): WebDestination {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return { kind: 'blocked' };
    if (url.protocol === 'zik:') {
      const token = url.searchParams.get('token');
      return url.hostname === 'handoff' && /^\/?$/.test(url.pathname) && token && /^[A-Za-z0-9_-]{43}$/.test(token) ? { kind: 'handoff', token } : { kind: 'blocked' };
    }
    if (url.origin !== origin) return url.protocol === 'https:' ? { kind: 'external', url: url.href } : { kind: 'blocked' };
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';
    if (path === '/app/handoff') {
      const token = url.searchParams.get('token');
      return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? { kind: 'handoff', token } : { kind: 'blocked' };
    }
    if (path === '/vault' || path.startsWith('/vault/')) return { kind: 'native', path: '/vault' };
    if (path === '/id' || path.startsWith('/id/')) return { kind: 'native', path: '/identity' };
    if (['/wallet', '/card/pair'].includes(path)) return { kind: 'native', path: '/wallet' };
    return { kind: 'web', url: url.href };
  } catch { return { kind: 'blocked' }; }
}
