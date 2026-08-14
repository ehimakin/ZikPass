import { describe, expect, it } from "vitest";
import {
  formatAdminDateTime,
  formatCurrencyGbp,
  formatFingerprint,
  getNotificationRecords,
  getRemainingSeconds,
  isCoolingComplete,
  stringifyForAdmin
} from "@/lib/shared/issuer-dashboard";

describe("issuer dashboard helpers", () => {
  it("formats a fingerprint when present and falls back when missing", () => {
    expect(formatFingerprint("abcdef1234567890fedcba")).toBe("Fingerprint abcdef1234567890...");
    expect(formatFingerprint(undefined)).toBe("Fingerprint unavailable");
    expect(formatFingerprint("")).toBe("Fingerprint unavailable");
  });

  it("formats admin timestamps defensively", () => {
    expect(formatAdminDateTime(undefined)).toBe("Not yet");
    expect(formatAdminDateTime("not-a-date", "Unavailable")).toBe("Unavailable");
    expect(formatAdminDateTime("2026-04-13T12:00:00.000Z")).toContain("2026");
  });

  it("handles missing notifications and optional cooling-off data", () => {
    expect(getNotificationRecords(undefined)).toEqual([]);
    expect(getRemainingSeconds(undefined)).toBeNull();
    expect(isCoolingComplete({ manually_advanced: true })).toBe(true);
  });

  it("formats optional admin payloads and currency safely", () => {
    expect(stringifyForAdmin(undefined, "Unavailable")).toBe("Unavailable");
    expect(stringifyForAdmin({ ok: true }, "Unavailable")).toContain('"ok": true');
    expect(formatCurrencyGbp(undefined)).toBe("GBP unavailable");
    expect(formatCurrencyGbp(0.01)).toBe("GBP 0.01");
  });
});
