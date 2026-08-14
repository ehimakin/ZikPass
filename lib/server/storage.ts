import { promises as fs } from "node:fs";
import { runtimeConfig } from "@/lib/shared/config";
import type {
  EnrollmentApplicationInput,
  EnrollmentRecord,
  EnrollmentStatus,
  PhysicalStoreSessionRecord
} from "@/lib/shared/types";
import { getRuntimeDataDir, getRuntimeStatePath, getSeedStatePath } from "@/lib/server/runtime-paths";

interface StoreData {
  enrollments: EnrollmentRecord[];
  physical_sessions: PhysicalStoreSessionRecord[];
}

interface LegacyEnrollmentRecord {
  id: string;
  lane?: EnrollmentRecord["lane"];
  assurance_level?: EnrollmentRecord["assurance_level"];
  issuance_channel?: EnrollmentRecord["issuance_channel"];
  created_at: string;
  updated_at?: string;
  holder_public_key: JsonWebKey;
  onboarding_completed_at?: string;
  holder_key_registered_at?: string;
  financial_check_completed_at?: string;
  cop_completed_at?: string;
  bank_verification_completed_at?: string;
  risk_evaluated_at?: string;
  credential_pending_at?: string;
  issuer_signature_created_at?: string;
  proof?: EnrollmentRecord["proof"];
  proof_evaluation?: EnrollmentRecord["proof_evaluation"];
  application_fingerprint?: string;
  duplicate_state?: EnrollmentRecord["duplicate_state"];
  application?: EnrollmentRecord["application"];
  providers?: EnrollmentRecord["providers"];
  bank_verification?: Partial<EnrollmentRecord["bank_verification"]>;
  cooling_off?: Partial<EnrollmentRecord["cooling_off"]>;
  risk_decision?: EnrollmentRecord["risk_decision"];
  orchestration?: EnrollmentRecord["orchestration"];
  notifications?: EnrollmentRecord["notifications"];
  status?: EnrollmentStatus | "awaiting_possession" | "issued_cooling_off" | "proof_rejected";
  manual_review_reason?: string;
  provider_scenario?: EnrollmentRecord["provider_scenario"];
  last_user_message?: string;
  last_retryable_error?: EnrollmentRecord["last_retryable_error"];
  issued_credential?: EnrollmentRecord["issued_credential"];
  physical_verification?: EnrollmentRecord["physical_verification"];
  possession?: {
    code: string;
    reference: string;
    status: "pending" | "verified";
    attempts: number;
    verified_at?: string;
  };
}

const dataDir = getRuntimeDataDir();
const seedStatePath = getSeedStatePath();
const runtimeStatePath = getRuntimeStatePath();

async function ensureStateFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(runtimeStatePath);
  } catch {
    await writeJsonAtomic(runtimeStatePath, { enrollments: [], physical_sessions: [] });
  }
}

async function readStore(): Promise<StoreData> {
  await ensureStateFile();
  const parsed = await readStateJson<{ enrollments?: LegacyEnrollmentRecord[]; physical_sessions?: unknown[] }>();

  return {
    enrollments: (parsed.enrollments ?? []).map(normalizeEnrollment),
    physical_sessions: normalizePhysicalSessions(parsed.physical_sessions)
  };
}

async function writeStore(store: StoreData): Promise<void> {
  await ensureStateFile();
  await writeJsonAtomic(runtimeStatePath, store);
}

export async function listEnrollments(): Promise<EnrollmentRecord[]> {
  const store = await readStore();
  return store.enrollments.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listPhysicalSessions(): Promise<PhysicalStoreSessionRecord[]> {
  const store = await readStore();
  return store.physical_sessions.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getEnrollment(id: string): Promise<EnrollmentRecord | undefined> {
  const store = await readStore();
  return store.enrollments.find((enrollment) => enrollment.id === id);
}

export async function getPhysicalSession(
  id: string
): Promise<PhysicalStoreSessionRecord | undefined> {
  const store = await readStore();
  return store.physical_sessions.find((session) => session.session_id === id);
}

export async function findPhysicalSessionByUserCode(
  code: string
): Promise<PhysicalStoreSessionRecord | undefined> {
  const store = await readStore();
  return store.physical_sessions.find((session) => session.user_code === code);
}

export async function upsertEnrollment(record: EnrollmentRecord): Promise<EnrollmentRecord> {
  const store = await readStore();
  const index = store.enrollments.findIndex((enrollment) => enrollment.id === record.id);

  if (index >= 0) {
    store.enrollments[index] = record;
  } else {
    store.enrollments.push(record);
  }

  await writeStore(store);
  return record;
}

export async function upsertPhysicalSession(
  record: PhysicalStoreSessionRecord
): Promise<PhysicalStoreSessionRecord> {
  const store = await readStore();
  const index = store.physical_sessions.findIndex((session) => session.session_id === record.session_id);

  if (index >= 0) {
    store.physical_sessions[index] = record;
  } else {
    store.physical_sessions.push(record);
  }

  await writeStore(store);
  return record;
}

function normalizeEnrollment(record: LegacyEnrollmentRecord): EnrollmentRecord {
  if (record.application && record.providers && record.risk_decision && record.orchestration) {
    return {
      ...record,
      lane: record.lane ?? "remote",
      assurance_level: record.assurance_level ?? "remote_standard",
      issuance_channel: record.issuance_channel ?? "remote"
    } as EnrollmentRecord;
  }

  const createdAt = record.created_at;
  const legacyStatus = record.status ?? "application_submitted";
  const legacyPossession = record.possession;
  const bankCode = legacyPossession?.code ?? record.bank_verification?.code ?? "000000";
  const bankReference =
    legacyPossession?.reference ?? record.bank_verification?.reference ?? `BANK-REF-${bankCode}`;
  const bankConfirmedAt = legacyPossession?.verified_at ?? record.bank_verification_completed_at;
  const transactionStatus =
    legacyPossession?.status === "verified"
      ? "confirmed"
      : legacyStatus === "proof_rejected"
        ? "pending"
        : "sent";

  const application: EnrollmentApplicationInput = {
    identity_match: {
      first_name: "Legacy",
      last_name: "Applicant",
      date_of_birth: "1990-01-01",
      current_home_address: "Legacy address"
    },
    bank_name: record.bank_verification?.bank_name ?? "Linked bank account",
    submitted_at: createdAt
  };

  const normalizedStatus = mapLegacyStatus(
    legacyStatus,
    transactionStatus,
    Boolean(record.issued_credential)
  );

  return {
    id: record.id,
    lane: record.lane ?? "remote",
    assurance_level: record.assurance_level ?? "remote_standard",
    issuance_channel: record.issuance_channel ?? "remote",
    created_at: createdAt,
    updated_at: record.updated_at ?? createdAt,
    onboarding_completed_at: record.onboarding_completed_at ?? createdAt,
    holder_key_registered_at: record.holder_key_registered_at ?? createdAt,
    financial_check_completed_at: record.financial_check_completed_at ?? createdAt,
    cop_completed_at: record.cop_completed_at ?? record.financial_check_completed_at ?? createdAt,
    bank_verification_completed_at: bankConfirmedAt,
    risk_evaluated_at: record.risk_evaluated_at ?? createdAt,
    credential_pending_at:
      record.credential_pending_at ??
      (legacyPossession?.status === "verified" ? createdAt : undefined),
    issuer_signature_created_at:
      record.issuer_signature_created_at ?? record.issued_credential?.payload.issued_at,
    application_fingerprint: record.application_fingerprint ?? `legacy_${record.id}`,
    duplicate_state: record.duplicate_state ?? {
      blocked: false,
      checked_at: createdAt
    },
    application,
    proof: record.proof ?? {
      type: "credit_adulthood_proof",
      signals: {
        has_primary_credit_account: true,
        oldest_account_age_months: 24,
        active_accounts_count: 1
      },
      derived: {
        confidence: "high"
      }
    },
    proof_evaluation: record.proof_evaluation ?? {
      approved: legacyStatus !== "proof_rejected",
      threshold_months: runtimeConfig.minOldestAccountMonths,
      reasons: legacyStatus === "proof_rejected" ? ["Legacy proof rejected."] : []
    },
    holder_public_key: record.holder_public_key,
    providers: record.providers ?? {
      financial_check: {
        provider: "financial-check-provider",
        attempts: 1,
        requested_at: createdAt,
        completed_at: record.financial_check_completed_at ?? createdAt
      },
      cop: {
        provider: "cop-provider",
        attempts: 1,
        requested_at: createdAt,
        completed_at: record.cop_completed_at ?? createdAt
      }
    },
    bank_verification: {
      bank_name: record.bank_verification?.bank_name ?? "Linked bank account",
      amount_gbp: record.bank_verification?.amount_gbp ?? 0.01,
      code: bankCode,
      reference: bankReference,
      provider_session_id:
        record.bank_verification?.provider_session_id ?? `legacy-banksess-${record.id}`,
      transaction_status: transactionStatus,
      attempts: legacyPossession?.attempts ?? record.bank_verification?.attempts ?? 0,
      max_attempts: record.bank_verification?.max_attempts ?? runtimeConfig.bankVerificationMaxAttempts,
      sent_at: record.bank_verification?.sent_at ?? createdAt,
      confirmed_at: bankConfirmedAt,
      failed_at: record.bank_verification?.failed_at,
      provider_execution: record.bank_verification?.provider_execution ?? {
        start: {
          provider: "bank-verification-provider",
          attempts: 1,
          requested_at: createdAt,
          completed_at: createdAt
        },
        confirm: {
          provider: "bank-verification-provider",
          attempts: legacyPossession?.attempts ?? 0,
          requested_at: bankConfirmedAt,
          completed_at: bankConfirmedAt
        }
      }
    },
    physical_verification: record.physical_verification,
    cooling_off: {
      started_at: record.cooling_off?.started_at ?? createdAt,
      ends_at:
        record.cooling_off?.ends_at ??
        new Date(new Date(createdAt).getTime() + runtimeConfig.coolingOffSeconds * 1000).toISOString(),
      duration_seconds: record.cooling_off?.duration_seconds ?? runtimeConfig.coolingOffSeconds,
      manually_advanced: record.cooling_off?.manually_advanced ?? false,
      satisfied_at: record.cooling_off?.satisfied_at
    },
    risk_decision: record.risk_decision ?? {
      state:
        normalizedStatus === "issued" || normalizedStatus === "approved_with_cooling_off"
          ? "approved"
          : normalizedStatus === "bank_verification_pending"
            ? "approved_with_cooling_off"
            : normalizedStatus === "declined_bank_control_failed"
              ? "declined_bank_control_failed"
              : normalizedStatus === "declined_identity_mismatch"
                ? "declined_identity_mismatch"
                : normalizedStatus === "declined_no_adult_signal"
                  ? "declined_no_adult_signal"
                  : normalizedStatus === "manual_review_required"
                    ? "manual_review_required"
                    : "approved_with_cooling_off",
      reasons: record.proof_evaluation?.reasons ?? [],
      retryable: false,
      requires_manual_review: normalizedStatus === "manual_review_required",
      eligible_for_cooling_off:
        normalizedStatus === "approved_with_cooling_off" || normalizedStatus === "issued",
      eligible_for_issuance:
        normalizedStatus === "approved_with_cooling_off" || normalizedStatus === "issued",
      evaluated_at: record.risk_evaluated_at ?? createdAt
    },
    orchestration: record.orchestration ?? {
      stage:
        normalizedStatus === "issued"
          ? "credential_returned"
          : normalizedStatus === "approved_with_cooling_off"
            ? "cooling_off_started"
            : normalizedStatus === "bank_verification_pending"
              ? "bank_verification_started"
              : normalizedStatus === "manual_review_required"
                ? "manual_review_required"
                : normalizedStatus.startsWith("declined_")
                  ? "declined"
                  : "application_submitted",
      events: [
        {
          stage: "application_submitted",
          at: createdAt,
          detail: "Legacy enrollment imported into the Sprint 6 orchestration model."
        }
      ],
      last_transition_at: record.updated_at ?? createdAt,
      issuance_status:
        record.issued_credential
          ? "issued"
          : normalizedStatus === "approved_with_cooling_off"
            ? "cooling_off"
            : "blocked"
    },
    notifications: record.notifications ?? [],
    status: normalizedStatus,
    manual_review_reason: record.manual_review_reason,
    provider_scenario: record.provider_scenario,
    last_user_message: record.last_user_message,
    last_retryable_error: record.last_retryable_error,
    issued_credential: record.issued_credential
  };
}

function normalizePhysicalSessions(
  input: unknown[] | undefined
): PhysicalStoreSessionRecord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((value) => {
    if (!value || typeof value !== "object") {
      return [];
    }

    const candidate = value as Partial<PhysicalStoreSessionRecord>;
    if (
      !candidate.session_id ||
      !candidate.store_id ||
      !candidate.store_name ||
      !candidate.location_id ||
      !candidate.created_at ||
      !candidate.updated_at ||
      !candidate.expires_at
    ) {
      return [];
    }

    return [
      {
        session_id: candidate.session_id,
        store_id: candidate.store_id,
        store_name: candidate.store_name,
        location_id: candidate.location_id,
        created_at: candidate.created_at,
        updated_at: candidate.updated_at,
        expires_at: candidate.expires_at,
        enrollment_id: candidate.enrollment_id,
        status: candidate.status ?? "open",
        user_code: candidate.user_code,
        user_code_generated_at: candidate.user_code_generated_at,
        user_code_expires_at: candidate.user_code_expires_at,
        code_consumed_at: candidate.code_consumed_at,
        clerk_verification: candidate.clerk_verification ?? {
          status: "pending"
        },
        device_auth: candidate.device_auth ?? {
          status: "pending"
        },
        attestation: candidate.attestation,
        completed_at: candidate.completed_at,
        minimized_at: candidate.minimized_at
      }
    ];
  });
}

function mapLegacyStatus(
  status: LegacyEnrollmentRecord["status"],
  transactionStatus: EnrollmentRecord["bank_verification"]["transaction_status"],
  hasIssuedCredential: boolean
): EnrollmentStatus {
  if (hasIssuedCredential || status === "issued") {
    return "issued";
  }

  if (status === "proof_rejected") {
    return "declined_identity_mismatch";
  }

  if (status === "issued_cooling_off") {
    return "approved_with_cooling_off";
  }

  if (status === "awaiting_possession" || transactionStatus === "sent") {
    return "bank_verification_pending";
  }

  return "application_submitted";
}

async function readStateContent(): Promise<string> {
  try {
    return await fs.readFile(runtimeStatePath, "utf8");
  } catch {
    return fs.readFile(seedStatePath, "utf8");
  }
}

async function readStateJson<T>(): Promise<T> {
  const content = await readStateContent();

  try {
    return JSON.parse(content) as T;
  } catch {
    const retriedContent = await readStateContent();
    return JSON.parse(retriedContent) as T;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tempPath = `${filePath}.${randomSuffix()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
