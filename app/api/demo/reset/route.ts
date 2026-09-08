import { NextResponse } from "next/server";
import { isDemoEnvironment } from "@/lib/shared/demo-environment";
import { resetDemoRuntimeState } from "@/lib/server/storage";

/**
 * Demo-only: wipe transient runtime state so the walkthrough can be repeated
 * from a clean slate. Gated on the demo environment (ZIK_ENV), never on
 * NODE_ENV. The issuer keypair and store catalogue are untouched.
 */
export async function POST() {
  if (!isDemoEnvironment) {
    return NextResponse.json({ error: "Not available in this environment." }, { status: 403 });
  }
  await resetDemoRuntimeState();
  return NextResponse.json({ ok: true, reset_at: new Date().toISOString() });
}
