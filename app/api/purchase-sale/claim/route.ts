import { NextRequest, NextResponse } from "next/server";
import { claimPurchaseSale } from "@/lib/server/purchase-sale";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json(await claimPurchaseSale(body.token, body.holderPublicKey), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not activate the pass." }, { status: 400 });
  }
}
