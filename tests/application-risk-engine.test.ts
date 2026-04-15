import { describe, expect, it } from "vitest";
import { DefaultApplicationRiskEngine } from "@/lib/server/services/risk/application-risk-engine";

const engine = new DefaultApplicationRiskEngine();

describe("application risk engine", () => {
  it("declines duplicate applications before other checks", () => {
    const decision = engine.evaluate({
      duplicate_state: {
        blocked: true,
        existing_enrollment_id: "enroll_existing",
        reason: "existing_pending_application",
        checked_at: "2026-04-14T10:00:00.000Z"
      }
    });

    expect(decision.state).toBe("declined_duplicate_application");
    expect(decision.retryable).toBe(false);
  });

  it("returns retry_provider_failure for transient provider errors", () => {
    const decision = engine.evaluate({
      duplicate_state: {
        blocked: false,
        checked_at: "2026-04-14T10:00:00.000Z"
      },
      financial_check: {
        outcome: "timeout",
        provider_reference: "fin_1",
        has_primary_credit_account: false,
        oldest_account_age_months: 0,
        active_accounts_count: 0,
        identity_match_score: 0,
        adult_signal_confidence: 0,
        matched_fields: [],
        retryable: true
      }
    });

    expect(decision.state).toBe("retry_provider_failure");
    expect(decision.retryable).toBe(true);
  });

  it("declines when no adult signal exists", () => {
    const decision = engine.evaluate({
      duplicate_state: {
        blocked: false,
        checked_at: "2026-04-14T10:00:00.000Z"
      },
      financial_check: {
        outcome: "adult_signal_missing",
        provider_reference: "fin_2",
        has_primary_credit_account: false,
        oldest_account_age_months: 0,
        active_accounts_count: 0,
        identity_match_score: 0.4,
        adult_signal_confidence: 0.1,
        matched_fields: ["full_name"],
        retryable: false
      }
    });

    expect(decision.state).toBe("declined_no_adult_signal");
  });

  it("routes medium-confidence applications into review after bank confirmation", () => {
    const decision = engine.evaluate({
      duplicate_state: {
        blocked: false,
        checked_at: "2026-04-14T10:00:00.000Z"
      },
      financial_check: {
        outcome: "match_medium_confidence",
        provider_reference: "fin_3",
        has_primary_credit_account: true,
        oldest_account_age_months: 18,
        active_accounts_count: 1,
        identity_match_score: 0.79,
        adult_signal_confidence: 0.74,
        matched_fields: ["full_name", "date_of_birth", "current_address"],
        retryable: false
      },
      cop: {
        outcome: "partial_match",
        provider_reference: "cop_1",
        matched_name: "Alice Example Ltd",
        confidence_score: 0.62,
        retryable: false,
        reason_codes: ["NAME_CLOSE_MATCH"]
      },
      bank_verification: {
        outcome: "code_confirmed",
        provider_reference: "bank_1",
        provider_session_id: "banksess_1",
        amount_gbp: 0.01,
        bank_reference: "BANK-REF-123456",
        expected_code: "123456",
        retryable: false
      }
    });

    expect(decision.state).toBe("approved_pending_review");
    expect(decision.requires_manual_review).toBe(true);
  });

  it("approves a fully matched application after bank confirmation", () => {
    const decision = engine.evaluate({
      duplicate_state: {
        blocked: false,
        checked_at: "2026-04-14T10:00:00.000Z"
      },
      financial_check: {
        outcome: "match_high_confidence",
        provider_reference: "fin_4",
        has_primary_credit_account: true,
        oldest_account_age_months: 36,
        active_accounts_count: 2,
        identity_match_score: 0.95,
        adult_signal_confidence: 0.92,
        matched_fields: ["full_name", "date_of_birth", "current_address"],
        retryable: false
      },
      cop: {
        outcome: "full_match",
        provider_reference: "cop_2",
        matched_name: "Alice Example",
        confidence_score: 0.98,
        retryable: false,
        reason_codes: []
      },
      bank_verification: {
        outcome: "code_confirmed",
        provider_reference: "bank_2",
        provider_session_id: "banksess_2",
        amount_gbp: 0.01,
        bank_reference: "BANK-REF-654321",
        expected_code: "654321",
        retryable: false
      }
    });

    expect(decision.state).toBe("approved");
    expect(decision.eligible_for_issuance).toBe(true);
  });
});
