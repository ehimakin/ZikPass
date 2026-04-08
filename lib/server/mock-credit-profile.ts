import type { CreditAdulthoodProof, IdentityMatchInput } from "@/lib/shared/types";

export function buildMockCreditProof(input: IdentityMatchInput): CreditAdulthoodProof {
  validateIdentityMatchInput(input);

  return {
    type: "credit_adulthood_proof",
    signals: {
      has_primary_credit_account: true,
      oldest_account_age_months: 24,
      active_accounts_count: 1
    },
    derived: {
      confidence: "high"
    }
  };
}

function validateIdentityMatchInput(input: IdentityMatchInput) {
  if (!input.first_name.trim() || !input.last_name.trim()) {
    throw new Error("Full name is required.");
  }

  if (!input.current_home_address.trim()) {
    throw new Error("Current home address is required.");
  }

  const dob = new Date(input.date_of_birth);
  if (Number.isNaN(dob.getTime())) {
    throw new Error("Date of birth must be a valid date.");
  }
}
