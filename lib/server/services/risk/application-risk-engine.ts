import type {
  ApplicationRiskDecision,
  BankVerificationNormalizedResponse,
  CopNormalizedResponse,
  FinancialCheckNormalizedResponse
} from "@/lib/shared/provider-contracts";
import type { DuplicateApplicationState } from "@/lib/shared/types";

export interface ApplicationRiskInput {
  duplicate_state: DuplicateApplicationState;
  financial_check?: FinancialCheckNormalizedResponse;
  cop?: CopNormalizedResponse;
  bank_verification?: BankVerificationNormalizedResponse;
}

export interface ApplicationRiskEngine {
  evaluate(input: ApplicationRiskInput): ApplicationRiskDecision;
}

export class DefaultApplicationRiskEngine implements ApplicationRiskEngine {
  evaluate(input: ApplicationRiskInput): ApplicationRiskDecision {
    const evaluated_at = new Date().toISOString();
    const reasons: string[] = [];

    if (input.duplicate_state.blocked) {
      reasons.push("An active Zik Pass application already exists for this application fingerprint.");
      return {
        state: "declined_duplicate_application",
        reasons,
        retryable: false,
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    const financial = input.financial_check;
    if (!financial) {
      reasons.push("Financial check has not completed.");
      return {
        state: "retry_provider_failure",
        reasons,
        retryable: true,
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    if (
      financial.outcome === "provider_unavailable" ||
      financial.outcome === "timeout" ||
      financial.outcome === "error"
    ) {
      reasons.push("Financial provider is temporarily unavailable.");
      return {
        state: "retry_provider_failure",
        reasons,
        retryable: true,
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    if (financial.outcome === "adult_signal_missing") {
      reasons.push("We could not find a strong adult financial signal.");
      return {
        state: "declined_no_adult_signal",
        reasons,
        retryable: false,
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    if (financial.outcome === "manual_review_required") {
      reasons.push(financial.manual_review_reason ?? "The financial provider asked for manual review.");
      return {
        state: "manual_review_required",
        reasons,
        retryable: false,
        requires_manual_review: true,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    const cop = input.cop;
    if (
      cop &&
      (cop.outcome === "unavailable" || cop.outcome === "error")
    ) {
      reasons.push("Confirmation of Payee is temporarily unavailable.");
      return {
        state: "retry_provider_failure",
        reasons,
        retryable: true,
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    if (financial.outcome === "no_match" || cop?.outcome === "no_match") {
      reasons.push("We could not confidently match the application identity.");
      return {
        state: "declined_identity_mismatch",
        reasons,
        retryable: false,
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    const bank = input.bank_verification;
    if (!bank || bank.outcome === "pending" || bank.outcome === "transaction_sent") {
      reasons.push("Bank control confirmation is still pending.");
      return {
        state: "approved_with_cooling_off",
        reasons,
        retryable: false,
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    if (bank.outcome === "provider_unavailable" || bank.outcome === "timeout") {
      reasons.push("Bank verification is temporarily unavailable.");
      return {
        state: "retry_provider_failure",
        reasons,
        retryable: true,
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    if (bank.outcome === "code_invalid" || bank.outcome === "verification_failed") {
      reasons.push("We could not confirm control of the selected bank account.");
      return {
        state: "declined_bank_control_failed",
        reasons,
        retryable: bank.outcome === "code_invalid",
        requires_manual_review: false,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    if (
      financial.outcome === "weak_match" ||
      financial.outcome === "match_medium_confidence" ||
      cop?.outcome === "partial_match"
    ) {
      reasons.push("The application passed but needs additional issuer review before issuance.");
      return {
        state: "approved_pending_review",
        reasons,
        retryable: false,
        requires_manual_review: true,
        eligible_for_cooling_off: false,
        eligible_for_issuance: false,
        evaluated_at
      };
    }

    reasons.push("Provider checks completed successfully. Cooling-off can begin.");
    return {
      state: "approved",
      reasons,
      retryable: false,
      requires_manual_review: false,
      eligible_for_cooling_off: true,
      eligible_for_issuance: true,
      evaluated_at
    };
  }
}
