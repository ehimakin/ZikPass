import type {
  PhysicalClerkVerificationState,
  PhysicalStoreSessionRecord,
  PhysicalVerificationState
} from "@/lib/shared/types";

export const PHYSICAL_CUSTOMER_PAUSE_THRESHOLD_MS = 12_000;

export function isPhysicalStoreSessionExpired(
  session: Pick<PhysicalStoreSessionRecord, "expires_at">,
  now: number = Date.now()
): boolean {
  return new Date(session.expires_at).getTime() <= now;
}

export function isPhysicalUserCodeExpired(userCodeExpiresAt: string, now: number = Date.now()): boolean {
  return new Date(userCodeExpiresAt).getTime() <= now;
}

/**
 * A user code that has expired is still usable once staff have confirmed the
 * ID check, so a slow clerk queue does not strand an otherwise-completed visit.
 */
export function isPhysicalVerificationSessionUsable(
  input: {
    sessionExpiresAt: string;
    userCodeExpiresAt: string;
    clerkVerificationStatus: PhysicalClerkVerificationState["status"];
  },
  now: number = Date.now()
): boolean {
  const sessionExpired = isPhysicalStoreSessionExpired({ expires_at: input.sessionExpiresAt }, now);
  const codeExpired = isPhysicalUserCodeExpired(input.userCodeExpiresAt, now);

  return !(sessionExpired || (codeExpired && input.clerkVerificationStatus !== "verified"));
}

export function isPhysicalCustomerPaused(
  input: {
    customerLastSeenAt?: string;
    thresholdMs?: number;
  },
  now: number = Date.now()
): boolean {
  const lastSeenAt = input.customerLastSeenAt ? new Date(input.customerLastSeenAt).getTime() : 0;
  const threshold = input.thresholdMs ?? PHYSICAL_CUSTOMER_PAUSE_THRESHOLD_MS;

  return Boolean(lastSeenAt && now - lastSeenAt > threshold);
}

export function derivePhysicalVerificationStatus(
  session: Pick<PhysicalStoreSessionRecord, "status" | "clerk_verification" | "device_auth">
): PhysicalVerificationState["status"] {
  if (session.status === "completed") {
    return "issued";
  }

  if (session.status === "rejected" || session.clerk_verification.status === "rejected") {
    return "rejected";
  }

  if (session.status === "expired") {
    return "expired";
  }

  if (session.device_auth.status === "verified" && session.clerk_verification.status === "verified") {
    return "verification_complete";
  }

  if (session.clerk_verification.status === "verified") {
    return "awaiting_device_auth";
  }

  return "awaiting_clerk_verification";
}
