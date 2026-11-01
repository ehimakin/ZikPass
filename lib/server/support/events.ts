import { after } from 'next/server';

/** Next keeps this work alive after the response. If no request lifecycle is
 * available (scripts/tests), the committed queue remains for the daily worker.
 */
export function scheduleSupportWork(deliveryIds: string[] = [], importErrors = false) {
  if (!deliveryIds.length && !importErrors) return;
  try {
    after(async () => {
      try {
        if (importErrors) {
          const { syncErrorReports } = await import('./service');
          await syncErrorReports('system', false);
        }
        const { processDeliveries } = await import('./delivery');
        await processDeliveries(deliveryIds);
      } catch {
        // Never report this through reportError: that would recursively alert.
        console.error('Support background processing failed; queued work remains for the daily worker.');
      }
    });
  } catch {
    // after() requires a Next request context. Do not undo committed records.
  }
}
