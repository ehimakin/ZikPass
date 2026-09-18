import { NextRequest, NextResponse } from 'next/server';
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === 'development';
  // 'wasm-unsafe-eval' is what lets the on-device OCR engine compile its WebAssembly.
  // It permits WebAssembly only; JavaScript eval stays blocked outside development.
  // frame-src blob: is for previewing a document the user already holds, in a sandboxed frame.
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' blob:${dev ? ' ws: wss:' : ''}; media-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; frame-src 'self' blob:; form-action 'self'; worker-src 'self' blob:`;
  const headers = new Headers(request.headers); headers.set('x-nonce',nonce); headers.set('Content-Security-Policy',csp);
  // Canonicalize the public Vault URL; both cases show the new page.
  const response = request.nextUrl.pathname === '/Vault'
    ? NextResponse.redirect(new URL('/vault' + request.nextUrl.search, request.url), 307)
    : NextResponse.next({request:{headers}});
  response.headers.set('Content-Security-Policy',csp);
  response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Frame-Options','DENY');response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=(self)');
  if(request.nextUrl.protocol==='https:')response.headers.set('Strict-Transport-Security','max-age=31536000');
  if(['/Vault','/vault','/id','/verify/id','/retail-demo','/api/disclosure','/api/demo-merchant','/api/zik-id'].some(p=>request.nextUrl.pathname.startsWith(p)))response.headers.set('Cache-Control','no-store');
  return response;
}
export const config = {matcher:['/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)']};
