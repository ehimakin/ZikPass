import { NextRequest, NextResponse } from "next/server";
import { OPERATOR_SESSION_COOKIE, readOperatorSession } from "@/lib/server/operator-session";
import { getDemoRetailVerifierToken } from "@/lib/server/retail-verifier";
import { startPurchaseSale, updatePurchaseSale } from "@/lib/server/purchase-sale";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const operator = await readOperatorSession(request.cookies.get(OPERATOR_SESSION_COOKIE)?.value);
    if (!operator) return NextResponse.json({ error: "Please sign in to the store terminal again." }, { status: 401 });
    if (request.headers.get("origin") && new URL(request.headers.get("origin")!).host !== (request.headers.get("host") ?? request.nextUrl.host)) return NextResponse.json({ error: "Unrecognised request origin." }, { status: 403 });
    const storeId = operator.storeId;
    const verifierToken = getDemoRetailVerifierToken();
    if (body.action === "start") return NextResponse.json(await startPurchaseSale(storeId, verifierToken, body.product === "digital_voucher" ? "digital_voucher" : "physical_card"));
    if (!["status", "confirm_id", "reject", "confirm_payment", "renew"].includes(body.action)) throw new Error("Unknown sale action.");
    return NextResponse.json(await updatePurchaseSale({ sessionId: body.sessionId, action: body.action, method: body.method, storeId, verifierToken }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update the sale." }, { status: 400 });
  }
}
