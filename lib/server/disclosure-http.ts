import { NextResponse } from 'next/server';
import { DISCLOSURE_DENIAL, DisclosureError } from './disclosure-service';
let windowStart = 0;
let requestsInWindow = 0;
export function limitDisclosureTraffic() {
  if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requestsInWindow = 0; }
  if (++requestsInWindow > 300) throw new DisclosureError('rate_limit');
}
export async function readDisclosureBody(request: Request): Promise<unknown> {
  limitDisclosureTraffic();
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new DisclosureError('binding');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new DisclosureError('invalid');
  const reader = request.body?.getReader(); if (!reader) throw new DisclosureError('invalid');
  const chunks: Uint8Array[] = []; let length = 0;
  try { while (true) { const {done,value} = await reader.read(); if (done) break; length += value.length; if (length > 24000) { await reader.cancel(); throw new DisclosureError('invalid'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function disclosureFailure(error: unknown) {
  // Only a finite reason code; never exception text, payload, token or profile.
  console.warn('disclosure_denied', error instanceof DisclosureError ? error.reason : 'invalid');
  return NextResponse.json({error:DISCLOSURE_DENIAL},{status:400,headers:{'Cache-Control':'no-store'}});
}
export function disclosureResponse(value: unknown) { return NextResponse.json(value,{headers:{'Cache-Control':'no-store'}}); }
