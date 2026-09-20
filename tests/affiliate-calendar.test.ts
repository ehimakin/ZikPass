import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createRegistration, joinPair } from "@/lib/server/affiliate-onboarding";
import { requestBooking, calendarOptions, updateBooking } from "@/lib/server/affiliate-booking";
import { POST } from "@/app/api/affiliate/booking/route";
let dir: string;
beforeEach(() => { dir = mkdtempSync(path.join(os.tmpdir(), "zik-calendar-")); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("ZIK_RUNTIME_DATA_DIR", dir); vi.stubEnv("ZIK_SMTP_HOST", ""); vi.stubEnv("ZIK_ONBOARDING_PUBLIC_URL", ""); vi.stubEnv("ZIK_ONBOARDING_AGENT_KEY", "agent-test-key-longer-than-thirty-two-characters"); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); });
async function setup() { const value = createRegistration("Calendar & Café", "http://localhost:3003", "http://localhost:3003/api/zik/callback"); const booked = await requestBooking(value.registration.id, value.token, "client@example.com", new Date(Date.now() + 86400000).toISOString()); return { ...value, ...booked }; }
it("generates Google event drafts and Apple-compatible ICS copies without exposing credentials", async () => {
  const value = await setup(); const result = calendarOptions(value.registration.id, value.token, "setup", "http://localhost:3000");
  const google = new URL(result.googleUrl); expect(google.origin).toBe("https://calendar.google.com"); expect(google.searchParams.get("action")).toBe("TEMPLATE"); expect(google.searchParams.get("text")).toBe("Requested: Zik onboarding: Calendar & Café"); expect(google.searchParams.get("dates")).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);
  expect(google.searchParams.get("details")).toContain(`/affiliates/session?id=${value.registration.id}`); expect(result.localOnly).toBe(true);
  expect(result.ics).toContain("METHOD:PUBLISH"); expect(result.ics).toContain("STATUS:TENTATIVE"); expect(result.ics).not.toContain("ATTENDEE"); expect(result.ics).not.toContain("ORGANIZER");
  expect(JSON.stringify(result)).not.toContain(value.token); expect(JSON.stringify(result)).not.toContain(value.pair.key); expect(JSON.stringify(result)).not.toContain("client@example.com");
});
it("allows authenticated paired roles, reflects confirmation, and blocks cancelled exports", async () => {
  const value = await setup(); const id = value.registration.id;
  const client = joinPair(id, value.pair.key, "client", value.token); const agent = joinPair(id, value.pair.key, "agent", process.env.ZIK_ONBOARDING_AGENT_KEY!);
  vi.stubEnv("ZIK_ONBOARDING_PUBLIC_URL", "https://onboarding.example.com");
  expect(calendarOptions(id, client.session, "pair", "http://localhost:3000").localOnly).toBe(false);
  await updateBooking(id, agent.session, "confirmed");
  const confirmed = calendarOptions(id, agent.session, "pair", "http://localhost:3000"); expect(confirmed.ics).toContain("STATUS:CONFIRMED"); expect(new URL(confirmed.googleUrl).searchParams.get("text")).toBe("Zik onboarding: Calendar & Café");
  await updateBooking(id, agent.session, "cancelled"); expect(() => calendarOptions(id, value.token, "setup", "http://localhost:3000")).toThrow("No open booking");
});
it("keeps calendar export behind origin and setup/session authorization", async () => {
  const value = await setup(); const request = (origin: string, token: string) => new NextRequest("http://localhost/api/affiliate/booking", { method: "POST", headers: { origin, Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "calendar", scope: "setup", id: value.registration.id }) });
  expect((await POST(request("https://other.example", value.token))).status).toBe(403); expect((await POST(request("http://localhost", "wrong"))).status).toBe(400);
  const response = await POST(request("http://localhost", value.token)); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
});
