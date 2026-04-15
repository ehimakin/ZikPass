import { createHash } from "node:crypto";
import type { DuplicateApplicationState, EnrollmentRecord, IdentityMatchInput } from "@/lib/shared/types";
import { listEnrollments } from "@/lib/server/storage";

const BLOCKING_STATUSES = new Set([
  "application_submitted",
  "bank_verification_pending",
  "physical_verification_pending",
  "device_auth_pending",
  "approved_with_cooling_off",
  "credential_pending_issuance",
  "approved_pending_review",
  "manual_review_required",
  "issued"
]);

export function buildApplicationFingerprint(input: IdentityMatchInput): string {
  const normalized = [
    normalizeValue(input.first_name),
    normalizeValue(input.last_name),
    normalizeDate(input.date_of_birth),
    normalizeValue(input.current_home_address),
    normalizeValue(input.previous_address ?? "")
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex");
}

export async function checkDuplicateApplication(
  applicationFingerprint: string
): Promise<DuplicateApplicationState> {
  const records = await listEnrollments();
  const conflictingRecord = records.find(
    (record) =>
      record.application_fingerprint === applicationFingerprint &&
      BLOCKING_STATUSES.has(record.status)
  );

  if (!conflictingRecord) {
    return {
      blocked: false,
      checked_at: new Date().toISOString()
    };
  }

  return {
    blocked: true,
    existing_enrollment_id: conflictingRecord.id,
    reason:
      conflictingRecord.status === "issued"
        ? "existing_issued_pass"
        : conflictingRecord.status === "approved_with_cooling_off" ||
            conflictingRecord.status === "credential_pending_issuance"
          ? "cooling_off_in_progress"
          : "existing_pending_application",
    checked_at: new Date().toISOString()
  };
}

export async function assertNoDuplicateApplication(
  applicationFingerprint: string
): Promise<DuplicateApplicationState> {
  const duplicateState = await checkDuplicateApplication(applicationFingerprint);

  if (duplicateState.blocked) {
    throw new Error(
      "A Zik Pass application for these details is already active on this device flow. Finish or delete the existing application before starting again."
    );
  }

  return duplicateState;
}

export function enrollmentMatchesFingerprint(
  enrollment: EnrollmentRecord,
  applicationFingerprint: string
): boolean {
  return enrollment.application_fingerprint === applicationFingerprint;
}

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeDate(value: string): string {
  return value.trim();
}
