import type { AgeCredential } from "@/lib/shared/types";
import { stableStringify } from "@/lib/shared/utils";

export function serializeCredentialPayload(payload: AgeCredential): string {
  return stableStringify(payload);
}
