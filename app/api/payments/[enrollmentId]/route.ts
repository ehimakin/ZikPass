import { NextResponse } from "next/server";
import { getPaymentsForEnrollment } from "@/lib/server/payments";
import { getDeviceBindings } from "@/lib/server/device-bindings";
import { toErrorResponse } from "@/lib/server/api-errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const params = await context.params;
    const [payments, deviceBindings] = await Promise.all([
      getPaymentsForEnrollment(params.enrollmentId),
      getDeviceBindings(params.enrollmentId)
    ]);

    return NextResponse.json({ payments, device_bindings: deviceBindings });
  } catch (error) {
    return toErrorResponse(error);
  }
}
