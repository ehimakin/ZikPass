import { describe, expect, it } from "vitest";
import { MockBankVerificationProvider } from "@/lib/server/services/providers/bank-verification/provider";
import { MockCopProvider } from "@/lib/server/services/providers/cop/provider";
import { MockFinancialCheckProvider } from "@/lib/server/services/providers/financial-check/provider";

describe("provider simulators", () => {
  it("returns a high-confidence financial match for the clean scenario", async () => {
    const provider = new MockFinancialCheckProvider();

    const result = await provider.runCheck({
      request: {
        application_id: "app_1",
        verification_session_id: "sess_1",
        full_name: "Alice Example",
        date_of_birth: "1995-01-01",
        current_address: "10 High Street"
      },
      scenario: "clean_adult_match",
      attempts: 1
    });

    expect(result.normalized_response.outcome).toBe("match_high_confidence");
    expect(result.normalized_response.identity_match_score).toBeGreaterThan(0.9);
    expect(result.normalized_response.has_primary_credit_account).toBe(true);
  });

  it("models a transient timeout that recovers on retry", async () => {
    const provider = new MockFinancialCheckProvider();

    const first = await provider.runCheck({
      request: {
        application_id: "app_2",
        verification_session_id: "sess_2",
        full_name: "Alice Example",
        date_of_birth: "1995-01-01",
        current_address: "10 High Street"
      },
      scenario: "provider_timeout",
      attempts: 1
    });

    const second = await provider.runCheck({
      request: {
        application_id: "app_2",
        verification_session_id: "sess_2",
        full_name: "Alice Example",
        date_of_birth: "1995-01-01",
        current_address: "10 High Street"
      },
      scenario: "provider_timeout",
      attempts: 2
    });

    expect(first.normalized_response.outcome).toBe("timeout");
    expect(first.normalized_response.retryable).toBe(true);
    expect(second.normalized_response.outcome).toBe("match_high_confidence");
  });

  it("returns CoP partial matches with confidence metadata", async () => {
    const provider = new MockCopProvider();

    const result = await provider.confirmPayee({
      request: {
        application_id: "app_3",
        verification_session_id: "sess_3",
        entered_account_holder_name: "Alice Example",
        bank_name: "Monzo",
        simulated_account_hint: "abc123"
      },
      scenario: "cop_partial_match",
      attempts: 1
    });

    expect(result.normalized_response.outcome).toBe("partial_match");
    expect(result.normalized_response.confidence_score).toBeGreaterThan(0.6);
    expect(result.normalized_response.reason_codes).toContain("NAME_CLOSE_MATCH");
  });

  it("supports invalid-code and verification-failed bank outcomes", async () => {
    const provider = new MockBankVerificationProvider();

    const start = await provider.startVerification({
      request: {
        application_id: "app_4",
        verification_session_id: "sess_4",
        bank_name: "Monzo",
        expected_reference_code: "123456"
      },
      scenario: "bank_verification_code_failure",
      attempts: 1
    });

    const firstConfirm = await provider.confirmVerification({
      request: {
        application_id: "app_4",
        verification_session_id: "sess_4",
        expected_reference_code: "123456",
        user_entered_code: "000000"
      },
      expected_code: "123456",
      provider_session_id: start.normalized_response.provider_session_id,
      scenario: "bank_verification_code_failure",
      attempts: 1
    });

    const thirdConfirm = await provider.confirmVerification({
      request: {
        application_id: "app_4",
        verification_session_id: "sess_4",
        expected_reference_code: "123456",
        user_entered_code: "000000"
      },
      expected_code: "123456",
      provider_session_id: start.normalized_response.provider_session_id,
      scenario: "bank_verification_code_failure",
      attempts: 3
    });

    expect(start.normalized_response.outcome).toBe("transaction_sent");
    expect(firstConfirm.normalized_response.outcome).toBe("code_invalid");
    expect(thirdConfirm.normalized_response.outcome).toBe("verification_failed");
  });
});
