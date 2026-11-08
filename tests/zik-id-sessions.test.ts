import { beforeEach, describe, expect, it } from "vitest";
import { answerZikIdSignalSession, consumeZikIdSignalSession, createZikIdSignalSession, readZikIdSignalSession, resetZikIdSignalSessionsForTests } from "@/lib/server/zik-id-sessions";

describe("Zik ID signaling sessions", () => {
  beforeEach(resetZikIdSignalSessionsForTests);

  it("stores only short-lived peer signaling and consumes it once", () => {
    const now = Date.now();
    const created = createZikIdSignalSession({ type: "offer", sdp: "offer-sdp" }, now);
    expect(JSON.stringify(created)).not.toMatch(/selfie|photo|legal_name/);
    const answered = answerZikIdSignalSession(created.id, created.code, { type: "answer", sdp: "answer-sdp" }, now + 1);
    expect(answered.answer).toEqual({ type: "answer", sdp: "answer-sdp" });
    expect(() => answerZikIdSignalSession(created.id, created.code, { type: "answer", sdp: "again" }, now + 2)).toThrow(/claimed/);
    expect(consumeZikIdSignalSession(created.id, created.code)).toBe(true);
    expect(readZikIdSignalSession(created.id, created.code, now + 3)).toBeUndefined();
  });

  it("rejects wrong codes, invalid descriptions and expired sessions", () => {
    expect(() => createZikIdSignalSession({ type: "answer", sdp: "wrong" })).toThrow();
    const now = Date.now();
    const created = createZikIdSignalSession({ type: "offer", sdp: "offer-sdp" }, now);
    expect(readZikIdSignalSession(created.id, "000000", now)).toBeUndefined();
    expect(readZikIdSignalSession(created.id, created.code, now + 120001)).toBeUndefined();
  });
});
