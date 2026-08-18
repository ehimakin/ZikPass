import { NextRequest, NextResponse } from "next/server";
import { recoverNativeAppHandoff } from "@/lib/server/mobile-handoff";

export async function POST(request: NextRequest) {
  const cookieToken = request.cookies.get("zikpass-pwa-handoff")?.value;
  const clientIp = getClientIp(request);
  const handoff = cookieToken
    ? { token: cookieToken, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }
    : await recoverNativeAppHandoff(clientIp);
  const response = NextResponse.json(
    handoff
      ? { token: handoff.token, expires_at: handoff.expiresAt }
      : { token: null, expires_at: null },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.delete("zikpass-pwa-handoff");
  return response;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
