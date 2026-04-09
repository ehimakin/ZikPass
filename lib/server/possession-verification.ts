import type { BankVerificationState } from "@/lib/shared/types";
import { randomNumericCode } from "@/lib/shared/utils";

export function createPossessionChallenge(bankName: string, sentAt: string): BankVerificationState {
  const code = randomNumericCode(6);

  return {
    bank_name: bankName,
    amount_gbp: 0.01,
    code,
    reference: `BANK-REF-${code}`,
    transaction_status: "sent",
    attempts: 0,
    sent_at: sentAt
  };
}
