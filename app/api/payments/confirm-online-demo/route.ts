import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/server/api-errors";
import { confirmOnlineDemoPayment } from "@/lib/server/payments";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { paymentId?: string; simulateFailure?: boolean };

    if (!body.paymentId?.trim()) {
      throw new Error("A payment reference is required.");
    }

    const payment = await confirmOnlineDemoPayment({
      paymentId: body.paymentId.trim(),
      simulateFailure: body.simulateFailure === true
    });

    return NextResponse.json(payment);
  } catch (error) {
    return toErrorResponse(error);
  }
}
