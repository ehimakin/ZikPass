import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/support/auth";
import { supportJson, supportFailure } from "@/lib/server/support/http";
import { getIssuerSessions } from "@/lib/server/enrollment-service";
import { getIssuerPublicKey } from "@/lib/server/issuer-keys";

export async function GET(request: NextRequest) {
  try {
  await requireAdmin(request);
  const [sessions, issuerPublicKey] = await Promise.all([getIssuerSessions(), getIssuerPublicKey()]);

  return supportJson({
    sessions,
    issuer_public_key: issuerPublicKey
  });
  } catch (error) { return supportFailure(error); }
}
