import { NextRequest } from 'next/server';
import { safeEqual } from '@/lib/server/support/auth';
import { processDeliveries } from '@/lib/server/support/delivery';
import { syncErrorReports } from '@/lib/server/support/service';
import { supportFailure, supportJson } from '@/lib/server/support/http';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !safeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return supportJson({ error: 'Unauthorized' }, 401);
  try {
    const imported = await syncErrorReports('system', false);
    return supportJson({ imported: imported.count, ...await processDeliveries() });
  } catch (error) { return supportFailure(error); }
}
