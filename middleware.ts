import { NextRequest, NextResponse } from 'next/server';
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === 'development';
  // Google Maps may be opened after client navigation without a new document.
  // Keep provider permissions consistent; the SDK still loads only on request.
  const googleConnections = ' https://maps.googleapis.com https://places.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com';
  const googleImages = ' https://maps.gstatic.com https://maps.googleapis.com';
  // 'wasm-unsafe-eval' is what lets the on-device OCR engine compile its WebAssembly.
  // It permits WebAssembly only; JavaScript eval stays blocked outside development.
  // frame-src blob: is for previewing a document the user already holds, in a sandboxed frame.
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:${googleImages}; font-src 'self' https://fonts.gstatic.com; connect-src 'self' blob:${dev ? ' ws: wss:' : ''}${googleConnections}; media-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; frame-src 'self' blob:; form-action 'self'; worker-src 'self' blob:`;
  const headers = new Headers(request.headers); headers.set('x-nonce',nonce); headers.set('Content-Security-Policy',csp);
  // Canonicalize the public Vault URL; both cases show the new page.
  const response = request.nextUrl.pathname === '/Vault'
    ? NextResponse.redirect(new URL('/vault' + request.nextUrl.search, request.url), 307)
    : NextResponse.next({request:{headers}});
  response.headers.set('Content-Security-Policy',csp);
  response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');response.headers.set('X-Frame-Options','DENY');response.headers.set('Permissions-Policy',request.nextUrl.pathname === '/dashboard/store/card' && dev ? 'camera=(self), microphone=(), geolocation=(self)' : 'camera=(), microphone=(), geolocation=(self)');
  if(request.nextUrl.protocol==='https:')response.headers.set('Strict-Transport-Security','max-age=31536000');
  if(['/dashboard','/partner_stores','/api/partners','/admin','/api/admin','/api/support','/help/ticket','/api/errors','/api/credential/status','/account-recovery','/api/account-recovery','/Vault','/vault','/id','/verify/id','/retail-demo','/api/disclosure','/api/demo-merchant','/api/zik-id','/recovery','/wallet/recovery','/r/','/api/recovery','/api/r/'].some(p=>request.nextUrl.pathname.startsWith(p)))response.headers.set('Cache-Control','no-store');
  return response;
}
export const config = {matcher:['/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)']};
