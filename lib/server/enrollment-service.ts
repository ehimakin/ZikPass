import { runtimeConfig } from "@/lib/shared/config";
import type { CreditAdulthoodProof, EnrollmentRecord } from "@/lib/shared/types";
import { randomId } from "@/lib/shared/utils";
import { issueCredential } from "@/lib/server/credential-issuer";
import { buildNotification } from "@/lib/server/notifications";
import { createPossessionChallenge } from "@/lib/server/possession-verification";
import { evaluateProof } from "@/lib/server/proof-evaluator";
import { getEnrollment, listEnrollments, upsertEnrollment } from "@/lib/server/storage";

export async function startEnrollment(input: {
  proof: CreditAdulthoodProof;
  holderPublicKey: JsonWebKey;
}): Promise<EnrollmentRecord> {
  const evaluation = evaluateProof(input.proof);
  const now = new Date();
  const coolingEnds = new Date(now.getTime() + runtimeConfig.coolingOffSeconds * 1000);

  const enrollment: EnrollmentRecord = {
    id: randomId("enroll"),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    proof: input.proof,
    proof_evaluation: evaluation,
    holder_public_key: input.holderPublicKey,
    possession: createPossessionChallenge(),
    cooling_off: {
      started_at: now.toISOString(),
      ends_at: coolingEnds.toISOString(),
      duration_seconds: runtimeConfig.coolingOffSeconds,
      manually_advanced: false
    },
    notifications: [
      buildNotification("Zik Pass would notify the account holder about this enrollment attempt.")
    ],
    status: evaluation.approved ? "awaiting_possession" : "proof_rejected"
  };

  return upsertEnrollment(enrollment);
}

export async function verifyPossessionCode(
  enrollmentId: string,
  code: string
): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);

  if (!record.proof_evaluation.approved) {
    throw new Error("Cannot verify possession on a rejected proof.");
  }

  record.possession.attempts += 1;

  if (record.possession.code !== code) {
    record.updated_at = new Date().toISOString();
    await upsertEnrollment(record);
    throw new Error("Incorrect refund confirmation code.");
  }

  record.possession.status = "verified";
  record.possession.verified_at = new Date().toISOString();
  record.issued_credential ??= await issueCredential(record);
  record.status = coolingOffSatisfied(record) ? "issued" : "issued_cooling_off";
  record.updated_at = new Date().toISOString();
  record.notifications.unshift(
    buildNotification(
      "Possession check passed. The credential has been delivered and is now in cooling-off."
    )
  );

  return upsertEnrollment(record);
}

export async function advanceCoolingOff(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);

  record.cooling_off.manually_advanced = true;
  record.cooling_off.ends_at = new Date().toISOString();
  record.cooling_off.satisfied_at = new Date().toISOString();

  if (record.possession.status === "verified" && record.proof_evaluation.approved) {
    if (record.issued_credential) {
      record.issued_credential = await issueCredential(record);
    }
    record.status = "issued";
  }

  record.updated_at = new Date().toISOString();
  record.notifications.unshift(
    buildNotification("Cooling-off period was manually advanced in demo mode.")
  );

  return upsertEnrollment(record);
}

export async function issueEnrollmentCredential(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);

  if (record.issued_credential) {
    record.status = coolingOffSatisfied(record) ? "issued" : "issued_cooling_off";
    return record;
  }

  if (!record.proof_evaluation.approved) {
    throw new Error("Proof evaluation failed.");
  }

  if (record.possession.status !== "verified") {
    throw new Error("Possession verification is still pending.");
  }

  record.issued_credential = await issueCredential(record);
  record.status = coolingOffSatisfied(record) ? "issued" : "issued_cooling_off";
  record.updated_at = new Date().toISOString();
  record.notifications.unshift(
    buildNotification(
      "Credential issued. Wallet can store it immediately, but access stays locked until cooling-off ends."
    )
  );

  return upsertEnrollment(record);
}

export async function getEnrollmentOrThrow(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);

  if (
    record.status === "issued_cooling_off" &&
    coolingOffSatisfied(record) &&
    record.possession.status === "verified"
  ) {
    record.status = "issued";
    record.cooling_off.satisfied_at ??= new Date().toISOString();
    record.updated_at = new Date().toISOString();
    await upsertEnrollment(record);
  }

  return record;
}

export async function getIssuerSessions(): Promise<EnrollmentRecord[]> {
  const records = await listEnrollments();

  return Promise.all(records.map((record) => getEnrollmentOrThrow(record.id)));
}

function coolingOffSatisfied(record: EnrollmentRecord): boolean {
  if (record.cooling_off.manually_advanced) {
    return true;
  }

  return new Date(record.cooling_off.ends_at).getTime() <= Date.now();
}

async function getExistingEnrollment(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getEnrollment(enrollmentId);

  if (!record) {
    throw new Error("Enrollment record not found.");
  }

  return record;
}
