import { getEnrollmentOrThrow } from "@/lib/server/enrollment-service";
import type { PaymentRecord } from "@/lib/shared/types";

/**
 * Best-effort: once a pass_issuance payment confirms, immediately re-check
 * whether the pass can now be issued, instead of waiting for the next
 * incidental poll from the clerk screen or the customer's device. Failures
 * here must never mask the payment confirmation itself succeeding — the
 * next poll from either side will catch up regardless.
 */
export async function triggerIssuanceRecheck(payment: PaymentRecord): Promise<void> {
  if (payment.purpose !== "pass_issuance" || payment.status !== "confirmed") {
    return;
  }

  try {
    await getEnrollmentOrThrow(payment.enrollment_id);
  } catch {
    // Ignored by design — see function comment.
  }
}
