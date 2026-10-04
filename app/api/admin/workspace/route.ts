import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/support/auth';
import { supportBody, supportFailure, supportJson } from '@/lib/server/support/http';
import { approvePartnerOnboarding, applyRetention, createOrLinkBug, getWorkspace, syncErrorReports, updateBug, updateTicket } from '@/lib/server/support/service';
import { SupportError } from '@/lib/server/support/store';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  try { await requireAdmin(request); return supportJson(await getWorkspace()); } catch (error) { return supportFailure(error); }
}
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request, true); const body = await supportBody(request);
    if (body.action === 'approve_partner') return supportJson(await approvePartnerOnboarding(session.actor, body));
    if (body.action === 'update_ticket') return supportJson(await updateTicket(session.actor, { ...body, action: 'update' }));
    if (body.action === 'reply_ticket') return supportJson(await updateTicket(session.actor, { ...body, action: 'message' }));
    if (body.action === 'create_bug') return supportJson(await createOrLinkBug(session.actor, body));
    if (body.action === 'update_bug') return supportJson(await updateBug(session.actor, body));
    if (body.action === 'sync_errors') return supportJson(await syncErrorReports(session.actor));
    if (body.action === 'retention' && body.confirm === 'REMOVE EXPIRED TICKETS') return supportJson(await applyRetention(session.actor));
    throw new SupportError('Unknown admin action.');
  } catch (error) { return supportFailure(error); }
}
