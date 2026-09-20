import { NextRequest } from 'next/server';
import { sameOrigin, secretHash } from '@/lib/server/support/auth';
import { clientIp, supportBody, supportFailure, supportJson, ticketKey } from '@/lib/server/support/http';
import { readCustomerTicket, replyToTicket } from '@/lib/server/support/service';
import { supportRateLimit } from '@/lib/server/support/store';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  try { await supportRateLimit(`ticket-view:${secretHash(clientIp(request))}`, 120, 60_000); return supportJson(await readCustomerTicket((await context.params).id, ticketKey(request))); } catch (error) { return supportFailure(error); }
}
export async function POST(request: NextRequest, context: Context) {
  try { sameOrigin(request); await supportRateLimit(`ticket-reply:${secretHash(clientIp(request))}`, 30, 3600_000); return supportJson(await replyToTicket((await context.params).id, ticketKey(request), await supportBody(request))); } catch (error) { return supportFailure(error); }
}
