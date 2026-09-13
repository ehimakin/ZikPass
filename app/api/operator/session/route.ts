import { NextRequest, NextResponse } from "next/server";
import {
  createOperatorSession,
  operatorCookieOptions,
  OPERATOR_SESSION_COOKIE,
  verifyOperatorLoginCode
} from "@/lib/server/operator-session";
import { getStoreById } from "@/lib/shared/stores";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { storeId?: unknown; code?: unknown };
    const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const store = getStoreById(storeId);
    if (!store || !verifyOperatorLoginCode(code)) {
      return NextResponse.json(
        { error: "That store or login code was not recognised." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    const session = await createOperatorSession(store.id);
    const response = NextResponse.json(
      { ok: true, store: { id: store.id, name: store.name } },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set(
      OPERATOR_SESSION_COOKIE,
      session.token,
      operatorCookieOptions(request.nextUrl.protocol === "https:")
    );
    return response;
  } catch {
    return NextResponse.json(
      { error: "The clerk login could not be completed. Please try again." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(OPERATOR_SESSION_COOKIE, "", {
    ...operatorCookieOptions(request.nextUrl.protocol === "https:"),
    maxAge: 0
  });
  return response;
}
