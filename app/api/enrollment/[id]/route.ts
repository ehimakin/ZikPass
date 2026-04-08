import { NextResponse } from "next/server";
import { getEnrollmentOrThrow } from "@/lib/server/enrollment-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const enrollment = await getEnrollmentOrThrow(params.id);
    return NextResponse.json(enrollment);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrollment not found." },
      { status: 404 }
    );
  }
}
