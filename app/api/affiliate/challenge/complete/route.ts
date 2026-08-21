import { NextRequest, NextResponse } from "next/server";
import { completeAffiliateChallenge, denyAffiliateChallenge } from "@/lib/server/affiliate-verifier";
import { toErrorResponse } from "@/lib/server/api-errors";
import type { PresentationBundle } from "@/lib/shared/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      request_id?: string;
      presentation_bundle?: PresentationBundle;
      denial_reason?: string;
    };

    if (!body.request_id?.trim()) {
      throw new Error("A request_id is required.");
    }

    const outcome = body.presentation_bundle
      ? await completeAffiliateChallenge({
          requestId: body.request_id.trim(),
          presentationBundle: body.presentation_bundle
        })
      : await denyAffiliateChallenge({
          requestId: body.request_id.trim(),
          reason: body.denial_reason ?? ""
        });

    return NextResponse.json(outcome);
  } catch (error) {
    return toErrorResponse(error);
  }
}
