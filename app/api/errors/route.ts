import { NextRequest } from "next/server";
import { getErrorReportByReference, getErrorReports } from "@/lib/server/error-reports";
import { requireAdmin } from "@/lib/server/support/auth";
import { supportFailure, supportJson } from "@/lib/server/support/http";
import { diagnosticPath, safeDiagnostic } from "@/lib/shared/support/validation";
import type { ErrorReportRecord } from "@/lib/shared/types";
const safe = (report: ErrorReportRecord) => ({ reference: report.reference, created_at: report.created_at, message: safeDiagnostic(report.message), operation: safeDiagnostic(report.operation, 100), route: diagnosticPath(report.route), recovery_action: report.recovery_action });
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const reference = request.nextUrl.searchParams.get("reference")?.trim();
    if (reference) { const report = await getErrorReportByReference(reference); return report ? supportJson(safe(report)) : supportJson({ error: "No report matches that reference." }, 404); }
    return supportJson({ reports: (await getErrorReports()).slice(0, 1000).map(safe) });
  } catch (error) { return supportFailure(error); }
}
