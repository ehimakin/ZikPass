import { describe, expect, it } from "vitest";
import { classifyError, redactErrorContext } from "@/lib/shared/errors";

describe("error classification", () => {
  it("classifies known recoverable message shapes without altering their text", () => {
    expect(classifyError(new Error("This in-store session has expired.")).code).toBe("session_expired");
    expect(classifyError(new Error("This app handoff has already been claimed.")).code).toBe(
      "duplicate_request"
    );
    expect(classifyError(new Error("No in-store verification session matches that code.")).code).toBe(
      "unknown_code"
    );
    expect(classifyError(new Error("The customer verification code is malformed.")).code).toBe(
      "invalid_code"
    );
    expect(classifyError(new Error("Failed to fetch")).code).toBe("network_failure");

    const original = "This store session has expired. Ask staff to start a new one.";
    expect(classifyError(new Error(original)).message).toBe(original);
  });

  it("falls back to an unexpected/report classification for unrecognised errors", () => {
    const classified = classifyError(new Error("Something totally novel broke."));
    expect(classified.code).toBe("unexpected");
    expect(classified.recoveryAction).toBe("report");
  });

  it("maps each recovery action consistently regardless of how the error was thrown", () => {
    expect(classifyError("This in-store session has expired.").recoveryAction).toBe("restart");
    expect(classifyError({ weird: true }).recoveryAction).toBe("report");
  });

  it("respects an explicit code override for server responses that already classified themselves", () => {
    const classified = classifyError(new Error("An extension payment is required."), "payment_required");
    expect(classified.code).toBe("payment_required");
    expect(classified.recoveryAction).toBe("resume");
  });

  it("redacts context keys that could carry private keys, identity, or payment data", () => {
    const redacted = redactErrorContext({
      enrollmentId: "enroll_abc123",
      holderPrivateKey: "should-not-survive",
      first_name: "should-not-survive",
      cardNumber: "should-not-survive",
      attempt: 2,
      succeeded: false
    });

    expect(redacted).toEqual({ enrollmentId: "enroll_abc123", attempt: 2, succeeded: false });
  });

  it("drops non-primitive context values instead of persisting arbitrary objects", () => {
    const redacted = redactErrorContext({ nested: { a: 1 }, list: [1, 2, 3], safe: "ok" });
    expect(redacted).toEqual({ safe: "ok" });
  });
});
