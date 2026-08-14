import { runtimeConfig } from "@/lib/shared/config";
import { randomId } from "@/lib/shared/utils";
import type {
  BankVerificationConfirmRequest,
  BankVerificationNormalizedResponse,
  BankVerificationRawResponse,
  BankVerificationStartRequest,
  ProviderSimulatorScenario
} from "@/lib/shared/provider-contracts";
import {
  resolveScenario,
  shouldTransientScenarioRecover,
  simulateProviderLatency
} from "@/lib/server/services/providers/simulator-utils";

export interface BankVerificationProvider {
  startVerification(input: {
    request: BankVerificationStartRequest;
    scenario?: ProviderSimulatorScenario;
    attempts: number;
  }): Promise<{
    latency_ms: number;
    raw_response: BankVerificationRawResponse;
    normalized_response: BankVerificationNormalizedResponse;
  }>;
  confirmVerification(input: {
    request: BankVerificationConfirmRequest;
    expected_code: string;
    provider_session_id: string;
    scenario?: ProviderSimulatorScenario;
    attempts: number;
  }): Promise<{
    latency_ms: number;
    raw_response: BankVerificationRawResponse;
    normalized_response: BankVerificationNormalizedResponse;
  }>;
}

export class MockBankVerificationProvider implements BankVerificationProvider {
  async startVerification(input: {
    request: BankVerificationStartRequest;
    scenario?: ProviderSimulatorScenario;
    attempts: number;
  }): Promise<{
    latency_ms: number;
    raw_response: BankVerificationRawResponse;
    normalized_response: BankVerificationNormalizedResponse;
  }> {
    const scenario = resolveScenario(input.scenario);
    const latency_ms = await simulateProviderLatency(1.2);
    const provider_request_id = randomId("bank");
    const provider_session_id = randomId("banksess");
    const recovered = shouldTransientScenarioRecover(scenario, input.attempts);

    if ((scenario === "provider_unavailable" || scenario === "provider_timeout") && !recovered) {
      const failedOutcome: "timeout" | "provider_unavailable" =
        scenario === "provider_timeout" ? "timeout" : "provider_unavailable";
      return {
        latency_ms,
        raw_response: {
          provider_request_id,
          provider_session_id,
          status: failedOutcome,
          amount_gbp: 0.01,
          bank_reference: `BANK-REF-${input.request.expected_reference_code}`,
          expected_code: input.request.expected_reference_code,
          failure_reason: failedOutcome
        },
        normalized_response: {
          outcome: failedOutcome,
          provider_reference: provider_request_id,
          provider_session_id,
          amount_gbp: 0.01,
          bank_reference: `BANK-REF-${input.request.expected_reference_code}`,
          expected_code: input.request.expected_reference_code,
          retryable: true,
          failure_reason: failedOutcome
        }
      };
    }

    return {
      latency_ms,
      raw_response: {
        provider_request_id,
        provider_session_id,
        status: "transaction_sent",
        amount_gbp: 0.01,
        bank_reference: `BANK-REF-${input.request.expected_reference_code}`,
        expected_code: input.request.expected_reference_code
      },
      normalized_response: {
        outcome: "transaction_sent",
        provider_reference: provider_request_id,
        provider_session_id,
        amount_gbp: 0.01,
        bank_reference: `BANK-REF-${input.request.expected_reference_code}`,
        expected_code: input.request.expected_reference_code,
        retryable: false
      }
    };
  }

  async confirmVerification(input: {
    request: BankVerificationConfirmRequest;
    expected_code: string;
    provider_session_id: string;
    scenario?: ProviderSimulatorScenario;
    attempts: number;
  }): Promise<{
    latency_ms: number;
    raw_response: BankVerificationRawResponse;
    normalized_response: BankVerificationNormalizedResponse;
  }> {
    const scenario = resolveScenario(input.scenario);
    const latency_ms = await simulateProviderLatency(0.9);
    const provider_request_id = randomId("bank");
    const recovered = shouldTransientScenarioRecover(scenario, input.attempts);

    if ((scenario === "provider_unavailable" || scenario === "provider_timeout") && !recovered) {
      const failedOutcome: "timeout" | "provider_unavailable" =
        scenario === "provider_timeout" ? "timeout" : "provider_unavailable";
      return {
        latency_ms,
        raw_response: {
          provider_request_id,
          provider_session_id: input.provider_session_id,
          status: failedOutcome,
          amount_gbp: 0.01,
          bank_reference: `BANK-REF-${input.expected_code}`,
          expected_code: input.expected_code,
          failure_reason: failedOutcome
        },
        normalized_response: {
          outcome: failedOutcome,
          provider_reference: provider_request_id,
          provider_session_id: input.provider_session_id,
          amount_gbp: 0.01,
          bank_reference: `BANK-REF-${input.expected_code}`,
          expected_code: input.expected_code,
          retryable: true,
          failure_reason: failedOutcome
        }
      };
    }

    if (
      scenario === "bank_verification_code_failure" &&
      input.attempts >= runtimeConfig.bankVerificationMaxAttempts
    ) {
      return {
        latency_ms,
        raw_response: {
          provider_request_id,
          provider_session_id: input.provider_session_id,
          status: "verification_failed",
          amount_gbp: 0.01,
          bank_reference: `BANK-REF-${input.expected_code}`,
          expected_code: input.expected_code,
          failure_reason: "TOO_MANY_INVALID_CODES"
        },
        normalized_response: {
          outcome: "verification_failed",
          provider_reference: provider_request_id,
          provider_session_id: input.provider_session_id,
          amount_gbp: 0.01,
          bank_reference: `BANK-REF-${input.expected_code}`,
          expected_code: input.expected_code,
          retryable: false,
          failure_reason: "TOO_MANY_INVALID_CODES"
        }
      };
    }

    if (
      scenario === "bank_verification_code_failure" ||
      input.request.user_entered_code !== input.expected_code
    ) {
      return {
        latency_ms,
        raw_response: {
          provider_request_id,
          provider_session_id: input.provider_session_id,
          status: "code_invalid",
          amount_gbp: 0.01,
          bank_reference: `BANK-REF-${input.expected_code}`,
          expected_code: input.expected_code,
          failure_reason: "CODE_INVALID"
        },
        normalized_response: {
          outcome: "code_invalid",
          provider_reference: provider_request_id,
          provider_session_id: input.provider_session_id,
          amount_gbp: 0.01,
          bank_reference: `BANK-REF-${input.expected_code}`,
          expected_code: input.expected_code,
          retryable: true,
          failure_reason: "CODE_INVALID"
        }
      };
    }

    return {
      latency_ms,
      raw_response: {
        provider_request_id,
        provider_session_id: input.provider_session_id,
        status: "code_confirmed",
        amount_gbp: 0.01,
        bank_reference: `BANK-REF-${input.expected_code}`,
        expected_code: input.expected_code
      },
      normalized_response: {
        outcome: "code_confirmed",
        provider_reference: provider_request_id,
        provider_session_id: input.provider_session_id,
        amount_gbp: 0.01,
        bank_reference: `BANK-REF-${input.expected_code}`,
        expected_code: input.expected_code,
        retryable: false
      }
    };
  }
}
