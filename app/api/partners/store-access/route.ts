import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/support/auth';
import { supportBody, supportFailure, supportJson } from '@/lib/server/support/http';
import { setStoreAccessCode } from '@/lib/server/store-access';
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request, true);
    const body = await supportBody(request);
    await setStoreAccessCode(typeof body.storeId === 'string' ? body.storeId : '', typeof body.code === 'string' ? body.code : '', session.actor);
    return supportJson({ ok: true });
  } catch (error) { return supportFailure(error); }
}
