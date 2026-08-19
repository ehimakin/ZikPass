import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/server/error-reports";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
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
