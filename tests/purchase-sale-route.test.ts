import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), start: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/server/operator-session", () => ({ OPERATOR_SESSION_COOKIE: "zik-operator-session", readOperatorSession: mocks.read }));
vi.mock("@/lib/server/purchase-sale", () => ({ startPurchaseSale: mocks.start, updatePurchaseSale: mocks.update }));
import { POST } from "@/app/api/purchase-sale/route";
function request(origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/purchase-sale", { method: "POST", headers: { origin, "content-type": "application/json", "x-zik-store-id": "wrong-store", "x-zik-retailer-token": "demo-retail-terminal" }, body: JSON.stringify({ action: "start", product: "digital_voucher" }) });
}
describe("purchase terminal authorisation", () => {
  it("rejects a shared-token header without a signed login", async () => {
    mocks.read.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
  });
  it("uses the signed store instead of a browser-supplied store", async () => {
    mocks.read.mockResolvedValueOnce({ storeId: "zik-london-001" });
    mocks.start.mockResolvedValueOnce({ id: "test" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.start).toHaveBeenLastCalledWith("zik-london-001", expect.any(String), "digital_voucher");
  });
  it("accepts the browser’s LAN host when Next internally uses localhost", async () => {
    mocks.read.mockResolvedValueOnce({ storeId: "zik-london-001" });
    mocks.start.mockResolvedValueOnce({ id: "test" });
    const lan = request("http://192.168.1.150:3000");
    lan.headers.set("host", "192.168.1.150:3000");
    expect((await POST(lan)).status).toBe(200);
  });
  it("rejects cross-origin mutations", async () => {
    mocks.read.mockResolvedValueOnce({ storeId: "zik-london-001" });
    expect((await POST(request("https://unrelated.example"))).status).toBe(403);
  });
});
