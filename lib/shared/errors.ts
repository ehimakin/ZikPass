import type { ErrorRecoveryAction } from "@/lib/shared/types";

/**
 * Structured error codes used across API responses. These are additive to
 * the existing `{ error: string }` shape (routes still return a message),
 * so older callers that only read `.error` keep working unchanged.
 */
export type ErrorCode =
  | "network_failure"
  | "session_expired"
  | "duplicate_request"
  | "lost_response"
  | "invalid_code"
  | "unknown_code"
  | "storage_unavailable"
  | "device_auth_failed"
  | "handoff_failed"
  | "state_conflict"
  | "payment_required"
  | "payment_failed"
  | "unexpected";

export interface ClassifiedError {
  code: ErrorCode;
  message: string;
  recoveryAction: ErrorRecoveryAction;
}

const RECOVERY_ACTION_BY_CODE: Record<ErrorCode, ErrorRecoveryAction> = {
  network_failure: "retry",
  session_expired: "restart",
  duplicate_request: "resume",
  lost_response: "resume",
  invalid_code: "retry",
  unknown_code: "retry",
  storage_unavailable: "retry",
  device_auth_failed: "retry",
  handoff_failed: "retry",
  state_conflict: "resume",
  payment_required: "resume",
  payment_failed: "retry",
  unexpected: "report"
};

const MESSAGE_PATTERNS: Array<{ pattern: RegExp; code: ErrorCode }> = [
  { pattern: /expired/i, code: "session_expired" },
  { pattern: /already been claimed|already been used|already been confirmed/i, code: "duplicate_request" },
  { pattern: /not recognised|no in-store verification session|store session not found/i, code: "unknown_code" },
  { pattern: /malformed/i, code: "invalid_code" },
  { pattern: /IndexedDB/i, code: "storage_unavailable" },
  { pattern: /device authentication|WebAuthn|device auth/i, code: "device_auth_failed" },
  { pattern: /handoff/i, code: "handoff_failed" },
  { pattern: /payment.*required/i, code: "payment_required" },
  { pattern: /payment.*failed|could not confirm.*payment/i, code: "payment_failed" },
  { pattern: /failed to fetch|network|NetworkError|ECONNREFUSED/i, code: "network_failure" }
];

/**
 * Classifies an error into a recoverability bucket without altering the
 * underlying message text (existing server error strings stay as-is; this
 * only adds a durable "what should the UI offer next" signal on top).
 */
export function classifyError(error: unknown, explicitCode?: ErrorCode): ClassifiedError {
  const message = errorMessage(error);

  if (explicitCode) {
    return { code: explicitCode, message, recoveryAction: RECOVERY_ACTION_BY_CODE[explicitCode] };
  }

  const matched = MESSAGE_PATTERNS.find((entry) => entry.pattern.test(message));
  const code = matched?.code ?? "unexpected";

  return { code, message, recoveryAction: RECOVERY_ACTION_BY_CODE[code] };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something unexpected happened.";
}

const REDACTED_KEY_PATTERN =
  /key|credential|private|token|identity|address|dob|date_of_birth|name|card|payment|secret|password/i;

/**
 * Strips any context key that looks like it could carry private keys,
 * identity data, or payment data before an error report is persisted.
 */
export function redactErrorContext(
  context: Record<string, unknown> | undefined
): Record<string, string | number | boolean | null> {
  if (!context) {
    return {};
  }

  const redacted: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(context)) {
    if (REDACTED_KEY_PATTERN.test(key)) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      redacted[key] = value;
    }
  }

  return redacted;
}
