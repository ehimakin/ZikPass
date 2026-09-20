import { NextRequest } from 'next/server';
import { sameOrigin, secretHash } from '@/lib/server/support/auth';
import { clientIp, supportBody, supportFailure, supportJson } from '@/lib/server/support/http';
import { createTicket } from '@/lib/server/support/service';
import { supportRateLimit, supportStorageReady } from '@/lib/server/support/store';
export const runtime = 'nodejs';
export function GET() { return supportJson({ available: supportStorageReady() }); }
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request); await supportRateLimit(`ticket-create:${secretHash(clientIp(request))}`, 5, 3600_000);
    return supportJson(await createTicket(await supportBody(request)), 201);
  } catch (error) { return supportFailure(error); }
}
