import { NextRequest, NextResponse } from 'next/server';
import { createPartnerApplication, readPartnerApplication, updatePartnerApplication, PartnerError, partnerPrototypeEnabled } from '@/lib/server/partner-applications';
import { supportBody } from '@/lib/server/support/http';
import { SupportError } from '@/lib/server/support/store';
export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
function failure(error: unknown) { return json({ error: error instanceof PartnerError || error instanceof SupportError ? error.message : 'Could not save your application. Please try again.' }, error instanceof PartnerError || error instanceof SupportError ? error.status : 503); }
const key = (request: NextRequest) => request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
export async function GET(request: NextRequest) {
  try { return json({ application: readPartnerApplication(request.nextUrl.searchParams.get('id') ?? '', key(request)) }); } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  if (!partnerPrototypeEnabled()) return json({ error: 'Partner application prototype is unavailable outside development.' }, 404);
  if (request.headers.get('origin') !== request.nextUrl.origin) return json({ error: 'Submit your application from this site.' }, 403);
  try {
    const body = await supportBody(request);
    if (body.action === 'create') return json({ application: createPartnerApplication(body.details, String(body.requestId ?? ''), key(request), request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local') }, 201);
    return json({ application: updatePartnerApplication(String(body.id ?? ''), key(request), body.action, body.task, body.complete) });
  } catch (error) { return failure(error); }
}
