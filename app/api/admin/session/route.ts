import { NextRequest } from 'next/server';
import { ADMIN_COOKIE, adminConfigured, adminCookieOptions, loginAdmin, logoutAdmin, readAdminSession, requireAdmin, sameOrigin } from '@/lib/server/support/auth';
import { clientIp, supportBody, supportFailure, supportJson } from '@/lib/server/support/http';
import { supportStorageReady } from '@/lib/server/support/store';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try { const session = await readAdminSession(request.cookies.get(ADMIN_COOKIE)?.value); return supportJson({ configured: adminConfigured(), storageReady: supportStorageReady(), session }); } catch (error) { return supportFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request); const body = await supportBody(request);
    const session = await loginAdmin(typeof body.username === 'string' ? body.username.slice(0, 80) : '', typeof body.password === 'string' ? body.password : '', clientIp(request));
    const response = supportJson({ actor: session.actor, csrf: session.csrf, expiresAt: session.expiresAt });
    response.cookies.set(ADMIN_COOKIE, session.token, adminCookieOptions(request.nextUrl.protocol === 'https:')); return response;
  } catch (error) { return supportFailure(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request, true); await logoutAdmin(request.cookies.get(ADMIN_COOKIE)!.value);
    const response = supportJson({ ok: true }); response.cookies.set(ADMIN_COOKIE, '', { ...adminCookieOptions(request.nextUrl.protocol === 'https:'), maxAge: 0 }); return response;
  } catch (error) { return supportFailure(error); }
}
