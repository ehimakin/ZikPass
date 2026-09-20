import { NextRequest, NextResponse } from 'next/server';
import { cardDemoEnabled } from '@/lib/shared/card-activation';
import { cardDemoAction } from '@/lib/server/card-activation-demo';
import { OPERATOR_SESSION_COOKIE, readOperatorSession } from '@/lib/server/operator-session';
export async function POST(request: NextRequest) {
  if (!cardDemoEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: 'Cross-origin request denied' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 2048) throw new Error('Request too large.');
    const body = JSON.parse(raw);
    if (!body || typeof body.action !== 'string') throw new Error('Invalid request.');
    const session = await readOperatorSession(request.cookies.get(OPERATOR_SESSION_COOKIE)?.value);
    if (!['pair', 'customer_bind', 'customer_status'].includes(body.action) && !session) return NextResponse.json({ error: 'Clerk login required.' }, { status: 401 });
    return NextResponse.json(await cardDemoAction(body, session ? { storeId: session.storeId, operator: session.nonce } : undefined), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Service unavailable.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
}
