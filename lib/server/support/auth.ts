import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { audit, SupportError, supportRateLimit, supportTransaction } from './store';
import type { NextRequest } from 'next/server';
const scrypt = promisify(scryptCallback);
export const ADMIN_COOKIE = 'zik-admin-session';
const TTL = 8 * 60 * 60_000;
const IDLE = 30 * 60_000;
export const secretHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function safeEqual(a: string, b: string): boolean { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); }
export function adminConfigured() { return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ZIK_ADMIN_PASSWORD_HASH ?? '') && Boolean(process.env.ZIK_ADMIN_USERNAME?.trim()); }
function configHash() { return secretHash(`${process.env.ZIK_ADMIN_USERNAME}:${process.env.ZIK_ADMIN_PASSWORD_HASH}`); }
export async function hashAdminPassword(password: string): Promise<string> {
  if (password.length < 14 || password.length > 256) throw new SupportError('Use an admin password between 14 and 256 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await scrypt(password, salt, 64) as Buffer).toString('hex')}`;
}
export async function loginAdmin(username: string, password: string, ip: string) {
  if (!adminConfigured()) throw new SupportError('Admin access is not configured. Run npm run admin:setup on the server.', 503);
  await supportRateLimit(`admin-login:${secretHash(ip)}`, 5, 15 * 60_000);
  await supportRateLimit('admin-login:global', 40, 15 * 60_000);
  const [, salt, expected] = process.env.ZIK_ADMIN_PASSWORD_HASH!.split(':');
  const actual = (await scrypt(password.slice(0, 257), salt, 64) as Buffer).toString('hex');
  if (password.length > 256 || !safeEqual(actual, expected) || !safeEqual(username, process.env.ZIK_ADMIN_USERNAME!.trim())) {
    await supportTransaction(data => { audit(data, 'anonymous', 'admin.login_failed', 'admin'); });
    throw new SupportError('Admin credentials were not recognised.', 401);
  }
  const token = randomBytes(32).toString('base64url');
  const session = { tokenHash: secretHash(token), csrf: randomBytes(32).toString('base64url'), actor: process.env.ZIK_ADMIN_USERNAME!.trim(), configHash: configHash(), createdAt: Date.now(), lastSeenAt: Date.now(), expiresAt: Date.now() + TTL };
  await supportTransaction(data => {
    data.sessions = data.sessions.filter(s => s.expiresAt > Date.now() && Date.now() - s.lastSeenAt < IDLE).slice(-9);
    data.sessions.push(session); audit(data, session.actor, 'admin.login', 'admin');
  });
  return { token, actor: session.actor, csrf: session.csrf, expiresAt: session.expiresAt };
}
export async function readAdminSession(token: string | undefined) {
  if (!adminConfigured() || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return supportTransaction(data => {
    const now = Date.now();
    data.sessions = data.sessions.filter(s => s.expiresAt > now && now - s.lastSeenAt < IDLE && s.configHash === configHash());
    const session = data.sessions.find(s => safeEqual(s.tokenHash, secretHash(token)));
    if (!session) return null;
    session.lastSeenAt = now;
    return { actor: session.actor, csrf: session.csrf, expiresAt: session.expiresAt };
  });
}
export function sameOrigin(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) throw new SupportError('This action must be submitted from this site.', 403);
}
export async function requireAdmin(request: NextRequest, mutation = false) {
  const session = await readAdminSession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!session) throw new SupportError('Sign in as an administrator to continue.', 401);
  if (mutation) { sameOrigin(request); if (!safeEqual(request.headers.get('x-csrf-token') ?? '', session.csrf)) throw new SupportError('Session confirmation failed. Reload and try again.', 403); }
  return session;
}
export async function logoutAdmin(token: string) {
  await supportTransaction(data => {
    const session = data.sessions.find(s => s.tokenHash === secretHash(token));
    data.sessions = data.sessions.filter(s => s.tokenHash !== secretHash(token));
    if (session) audit(data, session.actor, 'admin.logout', 'admin');
  });
}
export const adminCookieOptions = (secure: boolean) => ({ httpOnly: true, secure: secure || process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: TTL / 1000 });
