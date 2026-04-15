import { randomId } from "@/lib/shared/utils";
import type {
  FinancialCheckNormalizedResponse,
  FinancialCheckRawResponse,
  FinancialCheckRequest,
  ProviderSimulatorScenario
} from "@/lib/shared/provider-contracts";
import {
  resolveScenario,
  shouldTransientScenarioRecover,
  simulateProviderLatency
} from "@/lib/server/services/providers/simulator-utils";

export interface FinancialCheckProvider {
  runCheck(input: {
    request: FinancialCheckRequest;
    scenario?: ProviderSimulatorScenario;
    attempts: number;
  }): Promise<{
    latency_ms: number;
    raw_response: FinancialCheckRawResponse;
    normalized_response: FinancialCheckNormalizedResponse;
  }>;
}

export class MockFinancialCheckProvider implements FinancialCheckProvider {
  async runCheck(input: {
    request: FinancialCheckRequest;
    scenario?: ProviderSimulatorScenario;
    attempts: number;
  }): Promise<{
    latency_ms: number;
    raw_response: FinancialCheckRawResponse;
    normalized_response: FinancialCheckNormalizedResponse;
  }> {
    const scenario = resolveScenario(input.scenario);
    const latency_ms = await simulateProviderLatency(1);
    const provider_request_id = randomId("fin");
    const recovered = shouldTransientScenarioRecover(scenario, input.attempts);

    const base: FinancialCheckRawResponse = {
      provider_request_id,
      status: "match",
      identity_match_score: 0.96,
      adult_signal_confidence: 0.93,
      has_primary_credit_account: true,
      oldest_account_age_months: 42,
      active_accounts_count: 2,
      matched_fields: ["full_name", "date_of_birth", "current_address"],
      reason_codes: []
    };

    if ((scenario === "provider_unavailable" || scenario === "provider_timeout") && !recovered) {
      const failedOutcome: "provider_unavailable" | "timeout" =
        scenario === "provider_timeout" ? "timeout" : "provider_unavailable";

      return {
        latency_ms,
        raw_response: {
          ...base,
          status: failedOutcome,
          identity_match_score: 0,
          adult_signal_confidence: 0,
          has_primary_credit_account: false,
          oldest_account_age_months: 0,
          active_accounts_count: 0,
          matched_fields: [],
          reason_codes: [failedOutcome.toUpperCase()]
        },
        normalized_response: {
          outcome: failedOutcome,
          provider_reference: provider_request_id,
          has_primary_credit_account: false,
          oldest_account_age_months: 0,
          active_accounts_count: 0,
          identity_match_score: 0,
          adult_signal_confidence: 0,
          matched_fields: [],
          retryable: true
        }
      };
    }

    if (scenario === "no_adult_signal") {
      return {
        latency_ms,
        raw_response: {
          ...base,
          status: "adult_signal_missing",
          has_primary_credit_account: false,
          oldest_account_age_months: 0,
          active_accounts_count: 0,
          adult_signal_confidence: 0.14,
          matched_fields: ["full_name", "date_of_birth"],
          reason_codes: ["ADULT_SIGNAL_MISSING"]
        },
        normalized_response: {
          outcome: "adult_signal_missing",
          provider_reference: provider_request_id,
          has_primary_credit_account: false,
          oldest_account_age_months: 0,
          active_accounts_count: 0,
          identity_match_score: 0.64,
          adult_signal_confidence: 0.14,
          matched_fields: ["full_name", "date_of_birth"],
          retryable: false
        }
      };
    }

    if (scenario === "weak_financial_match" || scenario === "address_mismatch") {
      return {
        latency_ms,
        raw_response: {
          ...base,
          status: "partial_match",
          identity_match_score: 0.58,
          adult_signal_confidence: 0.55,
          oldest_account_age_months: 14,
          matched_fields:
            scenario === "address_mismatch"
              ? ["full_name", "date_of_birth"]
              : ["full_name", "date_of_birth", "current_address"],
          reason_codes:
            scenario === "address_mismatch" ? ["CURRENT_ADDRESS_MISMATCH"] : ["WEAK_MATCH"]
        },
        normalized_response: {
          outcome: "weak_match",
          provider_reference: provider_request_id,
          has_primary_credit_account: true,
          oldest_account_age_months: 14,
          active_accounts_count: 1,
          identity_match_score: 0.58,
          adult_signal_confidence: 0.55,
          matched_fields:
            scenario === "address_mismatch"
              ? ["full_name", "date_of_birth"]
              : ["full_name", "date_of_birth", "current_address"],
          retryable: false
        }
      };
    }

    if (scenario === "name_mismatch") {
      return {
        latency_ms,
        raw_response: {
          ...base,
          status: "no_match",
          identity_match_score: 0.18,
          adult_signal_confidence: 0.22,
          matched_fields: ["date_of_birth"],
          reason_codes: ["NAME_MISMATCH"]
        },
        normalized_response: {
          outcome: "no_match",
          provider_reference: provider_request_id,
          has_primary_credit_account: true,
          oldest_account_age_months: 24,
          active_accounts_count: 1,
          identity_match_score: 0.18,
          adult_signal_confidence: 0.22,
          matched_fields: ["date_of_birth"],
          retryable: false
        }
      };
    }

    if (scenario === "manual_review_required") {
      return {
        latency_ms,
        raw_response: {
          ...base,
          status: "manual_review",
          identity_match_score: 0.72,
          adult_signal_confidence: 0.63,
          matched_fields: ["full_name", "date_of_birth", "current_address"],
          reason_codes: ["REQUIRES_MANUAL_REVIEW"]
        },
        normalized_response: {
          outcome: "manual_review_required",
          provider_reference: provider_request_id,
          has_primary_credit_account: true,
          oldest_account_age_months: 18,
          active_accounts_count: 2,
          identity_match_score: 0.72,
          adult_signal_confidence: 0.63,
          matched_fields: ["full_name", "date_of_birth", "current_address"],
          retryable: false,
          manual_review_reason: "The provider returned a refer result that requires issuer review."
        }
      };
    }

    if (scenario === "cop_partial_match") {
      return {
        latency_ms,
        raw_response: {
          ...base,
          status: "partial_match",
          identity_match_score: 0.79,
          adult_signal_confidence: 0.74,
          matched_fields: ["full_name", "date_of_birth", "current_address"],
          reason_codes: ["NAME_VARIATION"]
        },
        normalized_response: {
          outcome: "match_medium_confidence",
          provider_reference: provider_request_id,
          has_primary_credit_account: true,
          oldest_account_age_months: 26,
          active_accounts_count: 1,
          identity_match_score: 0.79,
          adult_signal_confidence: 0.74,
          matched_fields: ["full_name", "date_of_birth", "current_address"],
          retryable: false
        }
      };
    }

    return {
      latency_ms,
      raw_response: base,
      normalized_response: {
        outcome: "match_high_confidence",
        provider_reference: provider_request_id,
        has_primary_credit_account: true,
        oldest_account_age_months: 42,
        active_accounts_count: 2,
        identity_match_score: 0.96,
        adult_signal_confidence: 0.93,
        matched_fields: ["full_name", "date_of_birth", "current_address"],
        retryable: false
      }
    };
  }
}
