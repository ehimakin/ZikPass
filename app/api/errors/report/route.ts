import { supportBody, clientIp } from "@/lib/server/support/http";
import { sameOrigin, secretHash } from "@/lib/server/support/auth";
import { supportRateLimit } from "@/lib/server/support/store";
import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/server/error-reports";

export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    await supportRateLimit(`error-report:${secretHash(clientIp(request))}`, 60, 60_000);
    const body = (await supportBody(request)) as {
      message?: string;
      operation?: string;
      route?: string;
      context?: Record<string, unknown>;
    };

    if (!body.message?.trim()) {
      throw new Error("A problem description is required to file a report.");
    }

    const report = await reportError({
      message: body.message.trim(),
      operation: body.operation,
      route: body.route,
      context: body.context
    });

    return NextResponse.json({ reference: report.reference });
  } catch {
    // Reporting a problem must never itself become an unrecoverable dead end.
    return NextResponse.json({ reference: null }, { status: 200 });
  }
}
