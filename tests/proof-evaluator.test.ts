import { describe, expect, it } from "vitest";
import { evaluateProof } from "@/lib/server/proof-evaluator";
import type { CreditAdulthoodProof } from "@/lib/shared/types";

function buildProof(overrides?: Partial<CreditAdulthoodProof["signals"]>): CreditAdulthoodProof {
  return {
    type: "credit_adulthood_proof",
    signals: {
      has_primary_credit_account: true,
      oldest_account_age_months: 18,
      active_accounts_count: 1,
      ...overrides
    },
    derived: {
      confidence: "high"
    }
  };
}

describe("evaluateProof", () => {
  it("approves a proof that meets the threshold", () => {
    const result = evaluateProof(buildProof());

    expect(result.approved).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("rejects a proof without a primary credit account", () => {
    const result = evaluateProof(buildProof({ has_primary_credit_account: false }));

    expect(result.approved).toBe(false);
    expect(result.reasons[0]).toContain("Primary credit account");
  });

  it("rejects a proof below the oldest-account threshold", () => {
    const result = evaluateProof(buildProof({ oldest_account_age_months: 3 }));

    expect(result.approved).toBe(false);
    expect(result.reasons[0]).toContain("Oldest account");
  });
});
