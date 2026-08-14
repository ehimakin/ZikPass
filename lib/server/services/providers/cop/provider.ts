import { randomId } from "@/lib/shared/utils";
import type {
  CopNormalizedResponse,
  CopRawResponse,
  CopRequest,
  ProviderSimulatorScenario
} from "@/lib/shared/provider-contracts";
import {
  normalizeName,
  resolveScenario,
  shouldTransientScenarioRecover,
  simulateProviderLatency
} from "@/lib/server/services/providers/simulator-utils";

export interface CopProvider {
  confirmPayee(input: {
    request: CopRequest;
    scenario?: ProviderSimulatorScenario;
    attempts: number;
  }): Promise<{
    latency_ms: number;
    raw_response: CopRawResponse;
    normalized_response: CopNormalizedResponse;
  }>;
}

export class MockCopProvider implements CopProvider {
  async confirmPayee(input: {
    request: CopRequest;
    scenario?: ProviderSimulatorScenario;
    attempts: number;
  }): Promise<{
    latency_ms: number;
    raw_response: CopRawResponse;
    normalized_response: CopNormalizedResponse;
  }> {
    const scenario = resolveScenario(input.scenario);
    const latency_ms = await simulateProviderLatency(0.8);
    const provider_request_id = randomId("cop");
    const recovered = shouldTransientScenarioRecover(scenario, input.attempts);
    const normalizedInputName = normalizeName(input.request.entered_account_holder_name);
    const canonicalName = normalizedInputName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");

    if ((scenario === "provider_unavailable" || scenario === "provider_timeout") && !recovered) {
      return {
        latency_ms,
        raw_response: {
          provider_request_id,
          status: "unavailable",
          matched_name: "",
          confidence_score: 0,
          reason_codes: [scenario.toUpperCase()]
        },
        normalized_response: {
          outcome: "unavailable",
          provider_reference: provider_request_id,
          matched_name: "",
          confidence_score: 0,
          retryable: true,
          reason_codes: [scenario.toUpperCase()]
        }
      };
    }

    if (scenario === "cop_no_match" || scenario === "name_mismatch") {
      return {
        latency_ms,
        raw_response: {
          provider_request_id,
          status: "no_match",
          matched_name: "",
          confidence_score: 0.18,
          reason_codes: ["NO_MATCH"]
        },
        normalized_response: {
          outcome: "no_match",
          provider_reference: provider_request_id,
          matched_name: "",
          confidence_score: 0.18,
          retryable: false,
          reason_codes: ["NO_MATCH"]
        }
      };
    }

    if (scenario === "cop_partial_match" || scenario === "address_mismatch") {
      return {
        latency_ms,
        raw_response: {
          provider_request_id,
          status: "partial_match",
          matched_name: `${canonicalName} Ltd`,
          confidence_score: 0.62,
          reason_codes: ["NAME_CLOSE_MATCH"]
        },
        normalized_response: {
          outcome: "partial_match",
          provider_reference: provider_request_id,
          matched_name: `${canonicalName} Ltd`,
          confidence_score: 0.62,
          retryable: false,
          reason_codes: ["NAME_CLOSE_MATCH"]
        }
      };
    }

    if (scenario === "manual_review_required") {
      return {
        latency_ms,
        raw_response: {
          provider_request_id,
          status: "partial_match",
          matched_name: canonicalName,
          confidence_score: 0.7,
          reason_codes: ["REVIEW_NAME_VARIANCE"]
        },
        normalized_response: {
          outcome: "partial_match",
          provider_reference: provider_request_id,
          matched_name: canonicalName,
          confidence_score: 0.7,
          retryable: false,
          reason_codes: ["REVIEW_NAME_VARIANCE"]
        }
      };
    }

    return {
      latency_ms,
      raw_response: {
        provider_request_id,
        status: "full_match",
        matched_name: canonicalName,
        confidence_score: 0.97,
        reason_codes: []
      },
      normalized_response: {
        outcome: "full_match",
        provider_reference: provider_request_id,
        matched_name: canonicalName,
        confidence_score: 0.97,
        retryable: false,
        reason_codes: []
      }
    };
  }
}
