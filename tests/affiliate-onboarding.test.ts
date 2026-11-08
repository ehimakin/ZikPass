import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createRegistration, getRegistration, updateRegistration, recordAffiliateEvidence } from "@/lib/server/affiliate-onboarding";
import { authenticateAffiliateClient, isAllowedAffiliateRedirectUri, getAffiliateClient } from "@/lib/server/affiliate-clients";
import { POST as manage, GET as status } from "@/app/api/affiliate/onboarding/route";
import { POST as connect } from "@/app/api/affiliate/connection/route";
let directory: string;
beforeEach(() => { directory = mkdtempSync(path.join(os.tmpdir(), "zik-onboarding-")); vi.stubEnv("ZIK_RUNTIME_DATA_DIR", directory); vi.stubEnv("NODE_ENV", "test"); });
afterEach(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
function setup() { return createRegistration("Test affiliate", "http://localhost:3003", "http://localhost:3003/api/zik/callback"); }
describe("development affiliate onboarding", () => {
  it("resumes by private invitation and persists only hashed credentials", () => {
    const { registration: row, token } = setup();
    const { secret } = updateRegistration(row.id, token, "credentials");
    expect(secret).toMatch(/^zik_dev_secret_/);
    expect(getRegistration(row.id, token).state).toBe("testing");
    expect(authenticateAffiliateClient(row.id, `Bearer ${secret}`)).toBe(true);
    expect(authenticateAffiliateClient(row.id, "Bearer wrong")).toBe(false);
    expect(() => getRegistration(row.id, "wrong")).toThrow("invalid or expired");
    const persisted = readFileSync(path.join(directory, "affiliate-onboarding.json"), "utf8");
    expect(persisted).not.toContain(token); expect(persisted).not.toContain(secret!);
    expect(getRegistration(row.id, token)).not.toHaveProperty("secretHash");
    expect(getAffiliateClient(row.id)?.display_name).toBe("Test affiliate");
    expect(isAllowedAffiliateRedirectUri(row.id, row.callback)).toBe(true);
    expect(isAllowedAffiliateRedirectUri(row.id, row.callback + "?other=1")).toBe(false);
  });
  it("requires successful exchange evidence, resets evidence on rotation, and disables access", () => {
    const { registration: row, token } = setup(); const first = updateRegistration(row.id, token, "credentials");
    expect(() => updateRegistration(row.id, token, "activate")).toThrow("round trip");
    recordAffiliateEvidence(row.id, "connectedAt");
    expect(() => updateRegistration(row.id, token, "activate")).toThrow("round trip");
    recordAffiliateEvidence(row.id, "verifiedAt");
    expect(updateRegistration(row.id, token, "activate").registration.state).toBe("active");
    const rotated = updateRegistration(row.id, token, "credentials");
    expect(rotated.registration.verifiedAt).toBeUndefined();
    expect(authenticateAffiliateClient(row.id, `Bearer ${first.secret}`)).toBe(false);
    expect(authenticateAffiliateClient(row.id, `Bearer ${rotated.secret}`)).toBe(true);
    updateRegistration(row.id, token, "disable");
    expect(authenticateAffiliateClient(row.id, `Bearer ${rotated.secret}`)).toBe(false);
    expect(getAffiliateClient(row.id)).toBeUndefined();
  });
  it("rejects unrelated callback origins, unsafe URLs, and expired invitations", () => {
    for (const url of ["https://evil.example/callback", "http://example.com/callback", "http://user:pass@localhost:3003/callback", "http://localhost:3003/callback#secret"]) expect(() => createRegistration("Test", "http://localhost:3003", url)).toThrow();
    const { registration: row, token } = setup();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 8 * 86400000);
    try { expect(() => getRegistration(row.id, token)).toThrow("expired"); } finally { vi.restoreAllMocks(); }
  });
  it("saves assistance against the same setup without implying a booking", () => {
    const { registration: row, token } = setup();
    expect(() => updateRegistration(row.id, token, "assistance", { email: "bad" })).toThrow();
    const result = updateRegistration(row.id, token, "assistance", { email: "dev@example.com", note: "Help with callback" });
    expect(result.registration.assistance?.note).toBe("Help with callback");
    expect(getRegistration(row.id, token).assistance?.email).toBe("dev@example.com");
  });
  it("fails closed in production", async () => {
    const { registration: row, token } = setup(); const { secret } = updateRegistration(row.id, token, "credentials");
    vi.stubEnv("NODE_ENV", "production");
    expect(authenticateAffiliateClient(row.id, `Bearer ${secret}`)).toBe(false);
    expect(() => setup()).toThrow("unavailable");
    expect((await status(new NextRequest(`http://localhost/api/affiliate/onboarding?id=${row.id}`))).status).toBe(404);
  });
  it("enforces request origin and invitation authentication on management routes", async () => {
    const payload = { action: "create", name: "Test", website: "http://localhost:3003", callback: "http://localhost:3003/api/zik/callback" };
    const request = (origin: string) => new NextRequest("http://localhost/api/affiliate/onboarding", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    expect((await manage(request("https://other.example"))).status).toBe(403);
    const created = await manage(request("http://localhost")); expect(created.status).toBe(201);
    const data = await created.json();
    const denied = await status(new NextRequest(`http://localhost/api/affiliate/onboarding?id=${data.registration.id}`)); expect(denied.status).toBe(401);
    const ok = await status(new NextRequest(`http://localhost/api/affiliate/onboarding?id=${data.registration.id}`, { headers: { Authorization: `Bearer ${data.token}` } })); expect(ok.status).toBe(200); expect(ok.headers.get("cache-control")).toBe("no-store");
  });
  it("connection check authenticates the callback and cannot fabricate a successful age exchange", async () => {
    const { registration: row, token } = setup(); const { secret } = updateRegistration(row.id, token, "credentials");
    const request = (callback: string) => new NextRequest("http://localhost/api/affiliate/connection", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ client_id: row.id, redirect_uri: callback }) });
    expect((await connect(request("https://other.example/callback"))).status).toBe(401);
    expect(getRegistration(row.id, token).connectedAt).toBeUndefined();
    expect((await connect(request(row.callback))).status).toBe(200);
    expect(getRegistration(row.id, token).connectedAt).toBeTruthy();
    expect(getRegistration(row.id, token).verifiedAt).toBeUndefined();
  });
});
