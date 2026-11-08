import { resetZikIdSignalSessions } from "@/lib/server/zik-id-sessions";
import { AGE_REQUEST_COOKIE, AGE_SESSION_COOKIE } from "@/lib/server/affiliate-demo-session";
import { OPERATOR_SESSION_COOKIE } from "@/lib/server/operator-session";
import { resetDisclosures } from "@/lib/server/disclosure-service";
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
  await resetDisclosures();
  resetZikIdSignalSessions();
  const response = NextResponse.json({ ok: true, reset_at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  for (const name of [AGE_REQUEST_COOKIE, AGE_SESSION_COOKIE, OPERATOR_SESSION_COOKIE, "zikpass-pwa-handoff"]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
  }
  response.cookies.set("zik-retail-pending", "", { path: "/api/demo-merchant", maxAge: 0, httpOnly: true, sameSite: "strict" });
  return response;
}
