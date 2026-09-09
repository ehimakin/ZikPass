import { NextRequest, NextResponse } from "next/server";
import { startPurchaseSale, updatePurchaseSale } from "@/lib/server/purchase-sale";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const storeId = request.headers.get("x-zik-store-id") ?? "";
    const verifierToken = request.headers.get("x-zik-retailer-token") ?? undefined;
    if (body.action === "start") return NextResponse.json(await startPurchaseSale(storeId, verifierToken));
    if (!["status", "confirm_id", "reject", "confirm_payment", "renew"].includes(body.action)) throw new Error("Unknown sale action.");
    return NextResponse.json(await updatePurchaseSale({ sessionId: body.sessionId, action: body.action, method: body.method, storeId, verifierToken }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update the sale." }, { status: 400 });
  }
}
