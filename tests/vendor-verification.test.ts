import { describe, expect, it } from "vitest";
import {
  buildHostedVerificationUrl,
  createVendorVerificationResult,
  type VendorVerificationSession
} from "@/lib/shared/vendor-verification";

const session: VendorVerificationSession = {
  session_id: "session_123",
  vendor_name: "ZikBet",
  vendor_origin: "http://localhost:3000",
  request: "over18"
};

describe("vendor verification helpers", () => {
  it("builds a hosted verification url with the session payload", () => {
    const url = buildHostedVerificationUrl(session);

    expect(url).toContain("/verify/zik?");
    expect(url).toContain("session=session_123");
    expect(url).toContain("vendor=ZikBet");
  });

  it("creates a minimal vendor verification result", () => {
    const result = createVendorVerificationResult(session, {
      verified: true,
      over18: true,
      credential_status: "active",
      outcome: "verified",
      assurance_level: "remote_standard"
    });

    expect(result.session_id).toBe(session.session_id);
    expect(result.vendor_name).toBe("ZikBet");
    expect(result.verified).toBe(true);
    expect(result.over18).toBe(true);
    expect(result.credential_status).toBe("active");
    expect(result.outcome).toBe("verified");
    expect(result.assurance_level).toBe("remote_standard");
  });
});
