import { describe, expect, test, vi, beforeEach } from "vitest";
import { DASHBOARD_ROLES, storeDestination } from "@/lib/shared/dashboard";
const auth = vi.hoisted(() => ({ operator: vi.fn(), admin: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/server/operator-session", () => ({ OPERATOR_SESSION_COOKIE: "operator", readOperatorSession: auth.operator }));
vi.mock("@/lib/server/support/auth", () => ({ ADMIN_COOKIE: "admin", readAdminSession: auth.admin }));
vi.mock("@/components/operator/clerk-verify", () => ({ ClerkVerify: () => null }));
vi.mock("@/components/operator/purchase-sale", () => ({ PurchaseSale: () => null }));
import Verify from "@/app/dashboard/store/verify/page";
import Purchase from "@/app/dashboard/store/purchase/page";
import Issuer from "@/app/dashboard/admin/issuer/page";
describe("dashboard role boundaries", () => {
  beforeEach(() => { auth.operator.mockResolvedValue(null); auth.admin.mockResolvedValue(null); });
  test("roles have separate workspace destinations", () => {
    expect(new Set(DASHBOARD_ROLES.map(role => role.href)).size).toBe(4);
  });
  test("login destinations cannot leave the store partition", () => {
    expect(storeDestination("https://example.com")).toBe("/dashboard/store");
    expect(storeDestination("/dashboard/admin")).toBe("/dashboard/store");
    expect(storeDestination("/verify/card")).toBe("/dashboard/store/card");
    expect(storeDestination("verify", "a&b")).toBe("/dashboard/store/verify?code=a%26b");
  });
  test("unauthenticated verification preserves the customer code through login", async () => {
    await expect(Verify({ searchParams: Promise.resolve({ code: "123456" }) })).rejects.toThrow("redirect:/dashboard/store/login?next=verify&code=123456");
  });
  test("purchase requires a store credential", async () => {
    await expect(Purchase()).rejects.toThrow("redirect:/dashboard/store/login?next=purchase");
  });
  test("the retired issuer console redirects to the admin workspace", () => {
    expect(() => Issuer()).toThrow("redirect:/dashboard/admin");
  });
});
