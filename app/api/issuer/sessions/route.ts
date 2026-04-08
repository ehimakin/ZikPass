import { NextResponse } from "next/server";
import { getIssuerSessions } from "@/lib/server/enrollment-service";
import { getIssuerPublicKey } from "@/lib/server/issuer-keys";

export async function GET() {
  const [sessions, issuerPublicKey] = await Promise.all([getIssuerSessions(), getIssuerPublicKey()]);

  return NextResponse.json({
    sessions,
    issuer_public_key: issuerPublicKey
  });
}
