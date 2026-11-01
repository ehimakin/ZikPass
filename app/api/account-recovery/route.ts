import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { accountRecoveryAction, accountRecoveryAvailable, AccountRecoveryError, createRecoveryChallenge } from '@/lib/server/account-recovery';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { MAX_BACKUP_BYTES, type RecoveryAction, type SignedRecoveryRequest } from '@/lib/shared/account-recovery/types';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export function GET() { return NextResponse.json({ available: accountRecoveryAvailable() }, { headers }); }

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) throw new AccountRecoveryError('Invalid origin.', 403);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    if (!checkRateLimit(`account-recovery:${createHash('sha256').update(ip).digest('hex')}`, 60, 300_000).allowed) throw new AccountRecoveryError('Too many attempts. Please wait five minutes.', 429);
    // Bound the actual stream, not just a caller-controlled Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw new AccountRecoveryError('Request body required.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BACKUP_BYTES + 16_384) { await reader.cancel(); throw new AccountRecoveryError('Backup exceeds the 32 MB limit.', 413); }
      chunks.push(value);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AccountRecoveryError('Invalid request.'); }
    if (body?.action === 'challenge') return NextResponse.json(await createRecoveryChallenge(body.recoveryId, body.forAction as RecoveryAction), { headers });
    return NextResponse.json(await accountRecoveryAction(body as SignedRecoveryRequest), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AccountRecoveryError ? error.message : 'Recovery could not complete. Please retry.' }, { status: error instanceof AccountRecoveryError ? error.status : 500, headers });
  }
}
