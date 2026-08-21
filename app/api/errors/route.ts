import { NextRequest, NextResponse } from "next/server";
import { getErrorReportByReference, getErrorReports } from "@/lib/server/error-reports";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference")?.trim();

  if (reference) {
    const report = await getErrorReportByReference(reference);

    if (!report) {
      return NextResponse.json({ error: "No report matches that reference." }, { status: 404 });
    }

    return NextResponse.json(report);
  }

  const reports = await getErrorReports();
  return NextResponse.json({ reports });
}
