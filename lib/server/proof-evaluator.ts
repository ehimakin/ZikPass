import { runtimeConfig } from "@/lib/shared/config";
import type { CreditAdulthoodProof, ProofEvaluation } from "@/lib/shared/types";

export function evaluateProof(proof: CreditAdulthoodProof): ProofEvaluation {
  const reasons: string[] = [];

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
