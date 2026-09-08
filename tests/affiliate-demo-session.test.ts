import { describe, expect, it, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { getIssuerKeyMaterial } from "@/lib/server/issuer-keys";
import { createAffiliateAgeSession, readAffiliateAgeSession, AGE_SESSION_TTL_MS, AGE_REQUEST_COOKIE, AGE_SESSION_COOKIE } from "@/lib/server/affiliate-demo-session";
const { exchange } = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/lib/server/affiliate-verifier", () => ({ exchangeAffiliateAuthorizationCode: exchange }));
import { POST } from "@/app/api/affiliate-demo/complete/route";

beforeAll(async () => { await getIssuerKeyMaterial(); });
describe("affiliate age session", () => {
  it("accepts a valid signed session, expiring after 30 minutes", async () => {
    const now = Date.now();
    const session = await createAffiliateAgeSession(new Date(now + 86400000).toISOString(), now);
    expect(session.expiresAt).toBe(now + AGE_SESSION_TTL_MS);
    expect(await readAffiliateAgeSession(session.token, now)).toMatchObject({ audience: "nightfall-demo", ageOver18: true });
    expect(await readAffiliateAgeSession(session.token, session.expiresAt)).toBeNull();
  });
  it("never outlasts the underlying pass", async () => {
    const now = Date.now();
    const session = await createAffiliateAgeSession(new Date(now + 1000).toISOString(), now);
    expect(session.expiresAt).toBe(now + 1000);
    await expect(createAffiliateAgeSession(new Date(now - 1).toISOString(), now)).rejects.toThrow();
    await expect(createAffiliateAgeSession("invalid", now)).rejects.toThrow();
  });
  it("rejects missing, malformed, tampered and audience-modified cookies", async () => {
    const session = await createAffiliateAgeSession(new Date(Date.now() + 60000).toISOString());
    const [encoded, signature] = session.token.split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    payload.audience = "another-affiliate";
    expect(await readAffiliateAgeSession(`${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`)).toBeNull();
    expect(await readAffiliateAgeSession(`${encoded}.invalid`)).toBeNull();
    expect(await readAffiliateAgeSession("true")).toBeNull();
    expect(await readAffiliateAgeSession(undefined)).toBeNull();
  });
});
function request(state: string, cookie = "expected") {
  return new NextRequest("http://localhost/api/affiliate-demo/complete", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${AGE_REQUEST_COOKIE}=${cookie}` }, body: JSON.stringify({ code: "one-time-code", state }) });
}
describe("affiliate callback binding", () => {
  it("rejects mismatched browser state before redeeming a code", async () => {
    exchange.mockClear();
    expect((await POST(request("attacker"))).status).toBe(400);
    expect(exchange).not.toHaveBeenCalled();
  });
  it("creates an HttpOnly age session only after successful server exchange", async () => {
    exchange.mockResolvedValueOnce({ age_over: true, threshold: 18, expires_at: new Date(Date.now() + 3600000).toISOString() });
    const response = await POST(request("expected"));
    expect(response.status).toBe(200);
    const cookie = response.cookies.get(AGE_SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(await readAffiliateAgeSession(cookie?.value)).not.toBeNull();
    expect(response.cookies.get(AGE_REQUEST_COOKIE)?.maxAge).toBe(0);
  });
  it("does not create a cookie on replay or failed age checks", async () => {
    exchange.mockRejectedValueOnce(new Error("Code already used"));
    const replay = await POST(request("expected"));
    expect(replay.status).toBe(400);
    expect(replay.cookies.get(AGE_SESSION_COOKIE)).toBeUndefined();
    exchange.mockResolvedValueOnce({ age_over: false, threshold: 18 });
    expect((await POST(request("expected"))).status).toBe(400);
  });
});
