import { randomId } from "@/lib/shared/utils";
import { classifyError, redactErrorContext } from "@/lib/shared/errors";
import { insertErrorReport } from "@/lib/server/storage";
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
    message: input.message.slice(0, 500),
    operation: input.operation?.slice(0, 200),
    route: input.route?.slice(0, 200),
    recovery_action: classified.recoveryAction,
    context: redactErrorContext(input.context)
  };

  return insertErrorReport(record);
}
