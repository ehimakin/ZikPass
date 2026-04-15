import { runtimeConfig } from "@/lib/shared/config";
import type { ApplicationRiskDecisionState, IssuanceStage } from "@/lib/shared/provider-contracts";
import type {
  CreditAdulthoodProof,
  EnrollmentRecord,
  EnrollmentStatus,
  IssuanceOrchestrationState,
  ProofEvaluation
} from "@/lib/shared/types";

export function buildProofFromProviderResults(record: EnrollmentRecord): CreditAdulthoodProof {
  const financial = record.providers.financial_check.normalized_response;
  const confidence =
    financial?.outcome === "match_high_confidence"
      ? "high"
      : financial?.outcome === "match_medium_confidence"
        ? "medium"
        : "low";

  return {
    type: "credit_adulthood_proof",
    signals: {
      has_primary_credit_account: financial?.has_primary_credit_account ?? false,
      oldest_account_age_months: financial?.oldest_account_age_months ?? 0,
      active_accounts_count: financial?.active_accounts_count ?? 0
    },
    derived: {
      confidence
    }
  };
}

export function evaluateDerivedProof(record: EnrollmentRecord): ProofEvaluation {
  const reasons: string[] = [];
  const proof = buildProofFromProviderResults(record);

  if (!proof.signals.has_primary_credit_account) {
    reasons.push("Primary credit account is required.");
  }

  if (proof.signals.oldest_account_age_months < runtimeConfig.minOldestAccountMonths) {
    reasons.push(
      `Oldest account must be at least ${runtimeConfig.minOldestAccountMonths} months old.`
    );
  }

  return {
    approved: reasons.length === 0,
    threshold_months: runtimeConfig.minOldestAccountMonths,
    reasons
  };
}

export function mapDecisionStateToEnrollmentStatus(
  decisionState: ApplicationRiskDecisionState,
  fallback: EnrollmentStatus
): EnrollmentStatus {
  switch (decisionState) {
    case "approved":
      return "approved_with_cooling_off";
    case "approved_with_cooling_off":
      return "approved_with_cooling_off";
    case "approved_pending_review":
      return "approved_pending_review";
    case "declined_identity_mismatch":
      return "declined_identity_mismatch";
    case "declined_no_adult_signal":
      return "declined_no_adult_signal";
    case "declined_bank_control_failed":
      return "declined_bank_control_failed";
    case "declined_duplicate_application":
      return "declined_duplicate_application";
    case "retry_provider_failure":
      return "retry_provider_failure";
    case "manual_review_required":
      return "manual_review_required";
    default:
      return fallback;
  }
}

export function createInitialOrchestration(nowIso: string): IssuanceOrchestrationState {
  return {
    stage: "application_submitted",
    events: [
      {
        stage: "application_submitted",
        at: nowIso,
        detail: "Application submitted and holder key registered."
      }
    ],
    last_transition_at: nowIso,
    issuance_status: "not_started"
  };
}

export function pushOrchestrationEvent(
  orchestration: IssuanceOrchestrationState,
  stage: IssuanceStage,
  detail: string,
  at: string
): IssuanceOrchestrationState {
  const alreadyRecorded = orchestration.events.some(
    (event) => event.stage === stage && event.detail === detail
  );

  if (alreadyRecorded) {
    return {
      ...orchestration,
      stage,
      last_transition_at: at
    };
  }

  return {
    ...orchestration,
    stage,
    last_transition_at: at,
    events: [...orchestration.events, { stage, at, detail }]
  };
}
