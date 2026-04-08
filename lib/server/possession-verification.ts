import type { PossessionState } from "@/lib/shared/types";
import { randomNumericCode } from "@/lib/shared/utils";

export function createPossessionChallenge(): PossessionState {
  const code = randomNumericCode(6);

  return {
    code,
    reference: `BANK-REF-${code}`,
    status: "pending",
    attempts: 0
  };
}
