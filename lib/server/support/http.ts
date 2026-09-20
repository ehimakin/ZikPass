import { NextRequest, NextResponse } from 'next/server';
import { SupportError } from './store';
export const SUPPORT_HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export function supportJson(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: SUPPORT_HEADERS }); }
export function supportFailure(error: unknown) { return supportJson({ error: error instanceof SupportError ? error.message : 'Support is temporarily unavailable. Please retry.' }, error instanceof SupportError ? error.status : 503); }
export async function supportBody(request: NextRequest): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new SupportError('Request body required.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 32_768) { await reader.cancel(); throw new SupportError('This request is too large. Text messages only.', 413); } chunks.push(value); }
  try { const data = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; } catch { throw new SupportError('Invalid request.'); }
}
export function clientIp(request: NextRequest) { return (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local').slice(0, 100); }
export function ticketKey(request: NextRequest) { const header = request.headers.get('authorization') ?? ''; return header.startsWith('Bearer ') ? header.slice(7) : ''; }
