import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRegistration, createPair, joinPair, pairProgress, getRegistration } from "@/lib/server/affiliate-onboarding";
import { requestBooking, updateBooking, bookingCalendar } from "@/lib/server/affiliate-booking";
const mail = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => mail } }));
let directory: string;
const agentKey = "test-agent-key-at-least-thirty-two-characters";
beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), "zik-pair-")); vi.stubEnv("ZIK_RUNTIME_DATA_DIR", directory); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("ZIK_ONBOARDING_AGENT_KEY", agentKey);
  for (const key of ["ZIK_SMTP_HOST", "ZIK_SMTP_FROM", "ZIK_ONBOARDING_EMAIL", "ZIK_ONBOARDING_PUBLIC_URL"]) vi.stubEnv(key, "");
  mail.sendMail.mockReset().mockResolvedValue({ accepted: ["agent@example.com", "client@example.com"], rejected: [] });
});
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
function setup() { return createRegistration("Test site", "http://localhost:3003", "http://localhost:3003/api/zik/callback"); }
function configureMail() { vi.stubEnv("ZIK_SMTP_HOST", "localhost"); vi.stubEnv("ZIK_SMTP_FROM", "sender@example.com"); vi.stubEnv("ZIK_ONBOARDING_EMAIL", "agent@example.com"); vi.stubEnv("ZIK_ONBOARDING_PUBLIC_URL", "https://dev.example.com"); }
describe("paired affiliate onboarding", () => {
  it("requires both pairing and role credentials, then shares only allowlisted form progress", () => {
    const { registration: row, token } = setup(); const pair = createPair(row.id, token);
    expect(() => joinPair(row.id, pair.key, "agent", token)).toThrow("agent credential");
    expect(() => joinPair(row.id, "wrong", "client", token)).toThrow("pairing key");
    expect(() => joinPair(row.id, pair.key, "client", "wrong")).toThrow("invalid or expired");
    const client = joinPair(row.id, pair.key, "client", token); const agent = joinPair(row.id, pair.key, "agent", agentKey);
    pairProgress(row.id, client.session, { form: { organisation: "Example", framework: "Next.js" } });
    const result = pairProgress(row.id, agent.session);
    expect(result).toMatchObject({ role: "agent", clientOnline: true, agentOnline: true, form: { organisation: "Example" } });
    expect(JSON.stringify(result)).not.toContain(token); expect(JSON.stringify(result)).not.toContain("tokenHash"); expect(JSON.stringify(result)).not.toContain("keyHash");
    expect(() => pairProgress(row.id, client.session, { form: { secret: "no" } })).toThrow("Invalid shared form");
    expect(() => pairProgress(row.id, agent.session, { form: { organisation: "Hijack" } })).toThrow("Only the client");
    expect(() => pairProgress(row.id, client.session, { guidance: "Pretend agent" })).toThrow("guidance");
    pairProgress(row.id, agent.session, { guidance: "Check the callback URL." });
    expect(pairProgress(row.id, client.session)).toMatchObject({ guidance: "Check the callback URL." });
    pairProgress(row.id, client.session, { end: true });
    expect(() => pairProgress(row.id, agent.session)).toThrow("Join this session");
  });
  it("rotating the pair invalidates old sessions and expired pairs reject joins", () => {
    const { registration: row, token } = setup(); const first = createPair(row.id, token); const client = joinPair(row.id, first.key, "client", token);
    const second = createPair(row.id, token);
    expect(() => pairProgress(row.id, client.session)).toThrow("Join this session");
    expect(() => joinPair(row.id, first.key, "client", token)).toThrow("pairing key");
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 8 * 86400000);
    try { expect(() => joinPair(row.id, second.key, "client", token)).toThrow("expired"); } finally { vi.restoreAllMocks(); }
  });
});
describe("assisted booking and calendar delivery", () => {
  it("saves a requested time honestly when delivery is unconfigured", async () => {
    const { registration: row, token } = setup();
    const result = await requestBooking(row.id, token, "client@example.com", new Date(Date.now() + 86400000).toISOString());
    expect(result.registration.booking).toMatchObject({ status: "requested", delivery: "not_configured" });
    expect(mail.sendMail).not.toHaveBeenCalled();
    expect(() => createPair(row.id, token)).toThrow("Cancel the existing booking");
    await expect(requestBooking(row.id, token, "client@example.com", new Date(Date.now() + 86400000).toISOString())).rejects.toThrow("already has a booking");
  });
  it("sends a calendar invitation with the session URL, excludes keys from its event, and permits only agent confirmation", async () => {
    configureMail(); const { registration: row, token } = setup();
    const result = await requestBooking(row.id, token, "client@example.com", new Date(Date.now() + 86400000).toISOString());
    expect(result.registration.booking?.delivery).toBe("sent");
    const message = mail.sendMail.mock.calls[0][0];
    expect(message.to).toEqual(["agent@example.com", "client@example.com"]);
    expect(message.text).toContain(result.pair.key); expect(message.text).not.toContain(token); expect(message.text).not.toContain(agentKey);
    const unfolded = message.icalEvent.content.replace(/\r\n /g, "");
    expect(unfolded).toContain(`https://dev.example.com/affiliates/session?id=${row.id}`);
    expect(unfolded).toContain("STATUS:TENTATIVE"); expect(unfolded).not.toContain(result.pair.key);
    const client = joinPair(row.id, result.pair.key, "client", token); const agent = joinPair(row.id, result.pair.key, "agent", agentKey);
    await expect(updateBooking(row.id, client.session, "confirmed")).rejects.toThrow("Only the paired agent");
    await updateBooking(row.id, agent.session, "confirmed");
    expect(getRegistration(row.id, token).booking).toMatchObject({ status: "confirmed", sequence: 1, delivery: "sent" });
    expect(mail.sendMail.mock.calls[1][0].icalEvent.content).toContain("STATUS:CONFIRMED");
    await updateBooking(row.id, agent.session, "cancelled");
    expect(mail.sendMail.mock.calls[2][0].icalEvent.method).toBe("CANCEL");
    expect(mail.sendMail.mock.calls[2][0].icalEvent.content).toContain("SEQUENCE:2");
  });
  it("records mail failures without claiming delivery or duplicating a retry", async () => {
    configureMail(); mail.sendMail.mockRejectedValue(new Error("SMTP down"));
    const { registration: row, token } = setup();
    const result = await requestBooking(row.id, token, "client@example.com", new Date(Date.now() + 86400000).toISOString());
    expect(result.registration.booking?.delivery).toBe("failed");
    await expect(requestBooking(row.id, token, "client@example.com", new Date(Date.now() + 86400000).toISOString())).rejects.toThrow("already has a booking");
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
  });
  it("rejects past times, mail-header injection and unreachable localhost invitation URLs", async () => {
    const { registration: row, token } = setup();
    await expect(requestBooking(row.id, token, "client@example.com", "2020-01-01")).rejects.toThrow("Request a 30-minute");
    await expect(requestBooking(row.id, token, "client@example.com\r\nBcc:other@example.com", new Date(Date.now() + 86400000).toISOString())).rejects.toThrow("valid contact");
    configureMail(); vi.stubEnv("ZIK_ONBOARDING_PUBLIC_URL", "http://localhost:3100");
    const result = await requestBooking(row.id, token, "client@example.com", new Date(Date.now() + 86400000).toISOString());
    expect(result.registration.booking?.delivery).toBe("not_configured"); expect(mail.sendMail).not.toHaveBeenCalled();
  });
  it("escapes calendar text and folds UTF-8 lines safely", () => {
    const content = bookingCalendar({ id: "test", name: "Name;with,delimiters\nEND:VEVENT" + "é".repeat(80), booking: { id: "booking", startsAt: "2026-09-21T12:00:00Z", endsAt: "2026-09-21T12:30:00Z", email: "client@example.com", status: "requested", delivery: "sent", sequence: 0, createdAt: "2026-09-20T12:00:00Z" } } as Parameters<typeof bookingCalendar>[0], "https://dev.example.com", "sender@example.com", "agent@example.com");
    expect(content).toContain("DTSTART:20260921T120000Z");
    expect(content.split("\r\n").filter(line => line === "END:VEVENT")).toHaveLength(1);
    expect(content.split("\r\n").every(line => Buffer.byteLength(line) <= 74)).toBe(true);
  });
});
