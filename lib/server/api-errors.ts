import { NextResponse } from "next/server";
import { PaymentRequiredError } from "@/lib/server/device-bindings";
import { classifyError } from "@/lib/shared/errors";

/**
 * Additive to the existing `{ error: string }` route shape — always keeps
 * that field so older callers that only read `.error` are unaffected, and
 * layers a `code`/`recovery_action` on top for the new recoverable-error UI.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof PaymentRequiredError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "payment_required",
        recovery_action: "resume",
        device_limit: error.deviceLimit,
        active_count: error.activeCount
      },
      { status: 402 }
    );
  }

  const classified = classifyError(error);
  return NextResponse.json(
    { error: classified.message, code: classified.code, recovery_action: classified.recoveryAction },
    { status: 400 }
  );
}
