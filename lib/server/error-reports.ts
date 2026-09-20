import { safeDiagnostic, diagnosticPath } from "@/lib/shared/support/validation";
import { randomId } from "@/lib/shared/utils";
import { classifyError, redactErrorContext } from "@/lib/shared/errors";
import { getErrorReport, insertErrorReport, listErrorReports } from "@/lib/server/storage";
import type { ErrorReportRecord } from "@/lib/shared/types";

export async function reportError(input: {
  message: string;
  operation?: string;
  route?: string;
  context?: Record<string, unknown>;
}): Promise<ErrorReportRecord> {
  const classified = classifyError(input.message);
  const record: ErrorReportRecord = {
    reference: randomId("err"),
    created_at: new Date().toISOString(),
    message: safeDiagnostic(input.message),
    operation: safeDiagnostic(input.operation, 200),
    route: diagnosticPath(input.route),
    recovery_action: classified.recoveryAction,
    context: Object.fromEntries(Object.entries(redactErrorContext(input.context)).slice(0, 20).map(([key, value]) => [key.slice(0, 100), typeof value === "string" ? safeDiagnostic(value, 200) : value]))
  };

  return insertErrorReport(record);
}

export async function getErrorReports(): Promise<ErrorReportRecord[]> {
  return listErrorReports();
}

export async function getErrorReportByReference(reference: string): Promise<ErrorReportRecord | undefined> {
  return getErrorReport(reference);
}
