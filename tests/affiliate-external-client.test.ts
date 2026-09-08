import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateAffiliateClient, isAllowedAffiliateRedirectUri } from "@/lib/server/affiliate-clients";
afterEach(() => vi.unstubAllEnvs());
describe("external JerkMeat registration", () => {
  it("fails closed when unconfigured", () => {
    vi.stubEnv("ZIK_JERKMEAT_CLIENT_SECRET", "");
    expect(authenticateAffiliateClient("jerkmeat", null)).toBe(false);
  });
  it("requires the registered secret and exact callback", () => {
    vi.stubEnv("ZIK_JERKMEAT_CLIENT_SECRET", "test-server-secret");
    vi.stubEnv("ZIK_JERKMEAT_REDIRECT_URI", "http://localhost:3001/api/zik/callback");
    expect(authenticateAffiliateClient("jerkmeat", "Bearer test-server-secret")).toBe(true);
    expect(authenticateAffiliateClient("jerkmeat", null)).toBe(false);
    expect(authenticateAffiliateClient("jerkmeat", "Bearer wrong")).toBe(false);
    expect(isAllowedAffiliateRedirectUri("jerkmeat", "http://localhost:3001/api/zik/callback")).toBe(true);
    expect(isAllowedAffiliateRedirectUri("jerkmeat", "https://other.example/api/zik/callback")).toBe(false);
    expect(authenticateAffiliateClient("unknown", "Bearer test-server-secret")).toBe(false);
  });
  it("preserves the embedded demo", () => {
    expect(authenticateAffiliateClient("nightfall-demo", null)).toBe(true);
    expect(isAllowedAffiliateRedirectUri("nightfall-demo", "/affiliate-demo/callback")).toBe(true);
  });
});
