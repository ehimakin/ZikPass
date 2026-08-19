import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/server/api-errors";
import { createPaymentRecord } from "@/lib/server/payments";
import type { PaymentMethod, PaymentPurpose } from "@/lib/shared/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      enrollmentId?: string;
      purpose?: PaymentPurpose;
      method?: PaymentMethod;
      storeId?: string;
    };

    if (!body.enrollmentId?.trim()) {
      throw new Error("An enrollment is required to start a payment.");
    }

    if (body.purpose !== "pass_issuance" && body.purpose !== "device_extension") {
      throw new Error("A valid payment purpose is required.");
    }

    if (body.method !== "cash_in_store" && body.method !== "online_demo") {
      throw new Error("A valid payment method is required.");
    }

    const payment = await createPaymentRecord({
      enrollmentId: body.enrollmentId.trim(),
      purpose: body.purpose,
      method: body.method,
      storeId: body.storeId?.trim() || undefined
    });

    return NextResponse.json(payment);
  } catch (error) {
    return toErrorResponse(error);
  }
}
