import { NextResponse } from "next/server";
import { runtimeConfig } from "@/lib/shared/config";
import { getIssuerPublicKey } from "@/lib/server/issuer-keys";

export async function GET() {
  const issuerPublicKey = await getIssuerPublicKey();

  return NextResponse.json({
    issuer_public_key: issuerPublicKey,
    config: runtimeConfig
  });
}
