import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/server/api-errors";
import { confirmCashPayment } from "@/lib/server/payments";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { paymentId?: string; confirmedBy?: string };

    if (!body.paymentId?.trim()) {
      throw new Error("A payment reference is required.");
    }

    const payment = await confirmCashPayment({
      paymentId: body.paymentId.trim(),
      confirmedBy: body.confirmedBy?.trim() || "Demo clerk"
    });

    return NextResponse.json(payment);
  } catch (error) {
    return toErrorResponse(error);
  }
}
