import type {
  AgeCredential,
  EnrollmentRecord,
  IssuanceChannel,
  PhysicalStoreContext,
  PhysicalStoreSessionRecord
} from "@/lib/shared/types";

export interface RemoteWalletEntryContext {
  lane: "remote";
}

export interface PhysicalWalletEntryContext extends Partial<PhysicalStoreContext> {
  lane: "physical";
}

export type WalletEntryContext = RemoteWalletEntryContext | PhysicalWalletEntryContext;

export type PhysicalProcessState =
  | "preparing_challenge"
  | "awaiting_retail_verification"
  | "verified"
  | "app_handoff"
  | "credential_issued"
  | "expired"
  | "rejected"
  | "session_error";

export const ZIK_APP_DOWNLOAD_URL = "https://zik.app/download";
export const PHYSICAL_USER_CODE_LENGTH = 6;

export type OnboardingEntryMode = "affiliate" | "app";

export function getOnboardingEntryMode(
  params:
    | URLSearchParams
    | {
        get(name: string): string | null;
      }
): OnboardingEntryMode {
  const source = params.get("source") ?? params.get("entry");
  const hasStoreContext = Boolean(
    params.get("session_id")?.trim() ||
      params.get("store_id")?.trim() ||
      params.get("store_name")?.trim() ||
      params.get("location_id")?.trim()
  );

  return source === "affiliate" && hasStoreContext || hasStoreContext ? "affiliate" : "app";
}

export function buildAffiliateOnboardingUrl(
  context: Partial<PhysicalStoreContext>
): string {
  const searchParams = new URLSearchParams({
    source: "affiliate",
    flow: "physical"
  });

  if (context.session_id) {
    searchParams.set("session_id", context.session_id);
  }

  if (context.store_id) {
    searchParams.set("store_id", context.store_id);
  }

  if (context.store_name) {
    searchParams.set("store_name", context.store_name);
  }

  if (context.location_id) {
    searchParams.set("location_id", context.location_id);
  }

  return `/onboarding?${searchParams.toString()}`;
}

export function buildAppOnboardingUrl(): string {
  return "/onboarding?source=app";
}

export function parseWalletEntryContext(
  params:
    | URLSearchParams
    | {
        get(name: string): string | null;
      }
): WalletEntryContext {
  const flow = params.get("flow");
  const sessionId = params.get("session_id");
  const storeId = params.get("store_id");
  const storeName = params.get("store_name");
  const locationId = params.get("location_id");
  const entryMode = params.get("entry_mode") === "retail_card" ? "retail_card" : "self_directed";

  if (flow === "remote") {
    return { lane: "remote" };
  }

  if (flow === "physical" || !flow) {
    return {
      lane: "physical",
      session_id: sessionId?.trim() || undefined,
      store_id: storeId?.trim() || undefined,
      store_name: storeName?.trim() || undefined,
      location_id: locationId?.trim() || undefined,
      entry_mode: entryMode
    };
  }

  return { lane: "physical", entry_mode: entryMode };
}

export function buildGenericPhysicalWalletUrl(
  context?: Partial<Omit<PhysicalStoreContext, "session_id" | "entry_mode">>
): string {
  const searchParams = new URLSearchParams({ flow: "physical", entry_mode: "retail_card" });

  if (context?.store_id) {
    searchParams.set("store_id", context.store_id);
  }

  if (context?.store_name) {
    searchParams.set("store_name", context.store_name);
  }

  if (context?.location_id) {
    searchParams.set("location_id", context.location_id);
  }

  return `/wallet?${searchParams.toString()}`;
}

export function buildPhysicalWalletUrl(session: PhysicalStoreSessionRecord): string {
  const searchParams = new URLSearchParams({
    flow: "physical",
    session_id: session.session_id,
    store_id: session.store_id,
    store_name: session.store_name,
    location_id: session.location_id
  });

  return `/wallet?${searchParams.toString()}`;
}

export function buildRetailVerificationScanUrl(input: {
  userCode: string;
  sessionId?: string;
}): string {
  const searchParams = new URLSearchParams({
    code: normalizeRetailVerificationCode(input.userCode)
  });

  if (input.sessionId) {
    searchParams.set("session_id", input.sessionId);
  }

  return `/verify?${searchParams.toString()}`;
}

export function normalizeRetailVerificationCode(value: string): string {
  return value.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, PHYSICAL_USER_CODE_LENGTH);
}

export function parseRetailVerificationCode(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed, "https://zik.local");
    const code = url.searchParams.get("code");

    if (code) {
      return normalizeRetailVerificationCode(code);
    }
  } catch {
    // Fall through to plain code parsing.
  }

  const codeParamMatch = trimmed.match(/[?&]code=([^&]+)/i);
  if (codeParamMatch?.[1]) {
    return normalizeRetailVerificationCode(decodeURIComponent(codeParamMatch[1]));
  }

  return normalizeRetailVerificationCode(trimmed);
}

export function isRetailVerificationCodeReady(value: string): boolean {
  return parseRetailVerificationCode(value).length === PHYSICAL_USER_CODE_LENGTH;
}

export function buildZikAppDeepLink(input?: {
  credentialId?: string;
  enrollmentId?: string;
}): string {
  const searchParams = new URLSearchParams();

  if (input?.credentialId) {
    searchParams.set("credential_id", input.credentialId);
  }

  if (input?.enrollmentId) {
    searchParams.set("enrollment_id", input.enrollmentId);
  }

  const query = searchParams.toString();
  return `zik://pass/open${query ? `?${query}` : ""}`;
}

export function getPhysicalProcessState(input: {
  credentialIssued?: boolean;
  enrollment?: Pick<
    EnrollmentRecord,
    "status" | "physical_verification" | "issued_credential"
  > | null;
  session?: Pick<PhysicalStoreSessionRecord, "status" | "user_code"> | null;
  hasSessionStarted?: boolean;
}): PhysicalProcessState {
  const enrollment = input.enrollment;
  const verification = enrollment?.physical_verification;
  const sessionStatus = input.session?.status;
  const verificationStatus = verification?.status;

  if (input.credentialIssued || enrollment?.issued_credential) {
    return "credential_issued";
  }

  if (
    enrollment?.status === "verification_session_expired" ||
    verificationStatus === "expired" ||
    sessionStatus === "expired"
  ) {
    return "expired";
  }

  if (
    enrollment?.status === "declined_physical_verification" ||
    verificationStatus === "rejected" ||
    sessionStatus === "rejected" ||
    sessionStatus === "cancelled"
  ) {
    return "rejected";
  }

  if (
    enrollment?.status === "approved_with_cooling_off" ||
    enrollment?.status === "credential_pending_issuance"
  ) {
    return "app_handoff";
  }

  if (
    enrollment?.status === "device_auth_pending" ||
    verification?.clerk_verification.status === "verified" ||
    sessionStatus === "awaiting_device_auth" ||
    sessionStatus === "ready_for_issuance"
  ) {
    return "verified";
  }

  if (
    enrollment?.status === "physical_verification_pending" ||
    verification?.user_code.value ||
    input.session?.user_code ||
    sessionStatus === "claimed"
  ) {
    return "awaiting_retail_verification";
  }

  if (input.hasSessionStarted || input.session) {
    return "preparing_challenge";
  }

  return "preparing_challenge";
}

export function formatAssuranceLevel(assuranceLevel: AgeCredential["assurance_level"]): string {
  return assuranceLevel === "in_person_verified" ? "In-person verified" : "Remote standard";
}

export function formatIssuanceChannel(channel: IssuanceChannel): string {
  return channel === "physical" ? "In store" : "Remote";
}

export function getCredentialExperienceVariant(
  credential?: Pick<AgeCredential, "assurance_level" | "issuance_channel">
): "remote" | "physical" {
  if (!credential) {
    return "remote";
  }

  return credential.issuance_channel === "physical" ||
    credential.assurance_level === "in_person_verified"
    ? "physical"
    : "remote";
}
