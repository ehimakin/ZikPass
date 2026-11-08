import { NextRequest, NextResponse } from 'next/server';
import { isHolderRevoked } from '@/lib/server/storage';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 2048) return NextResponse.json({ error: 'Invalid status request.' }, { status: 400, headers });
    const body = JSON.parse(raw);
    if (typeof body.credentialId !== 'string' || body.credentialId.length > 128 || typeof body.holderX !== 'string' || body.holderX.length > 128) return NextResponse.json({ error: 'Invalid status request.' }, { status: 400, headers });
    return NextResponse.json({ revoked: await isHolderRevoked(body.credentialId, body.holderX) }, { headers });
  } catch { return NextResponse.json({ error: 'Credential status is unavailable.' }, { status: 503, headers }); }
}
