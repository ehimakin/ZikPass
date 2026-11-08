import { NextRequest, NextResponse } from "next/server";
import { connectPurchaseSale } from "@/lib/server/purchase-sale";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const body = await request.json();
    return NextResponse.json(await connectPurchaseSale(body.token), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not connect. Please retry." }, { status: 400, headers });
  }
}
