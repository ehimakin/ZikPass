import { describe, expect, it, vi } from "vitest";
import { PhysicalSessionError } from "@/lib/server/physical-session-error";
const { readSession } = vi.hoisted(() => ({ readSession: vi.fn() }));
vi.mock("@/lib/server/enrollment-service", () => ({ getPhysicalStoreSessionOrThrow: readSession }));
import { GET } from "@/app/api/physical/sessions/[id]/route";

const request = () => GET(new Request("http://localhost/api/physical/sessions/test"), { params: Promise.resolve({ id: "test" }) });
describe("physical session status errors", () => {
  it("reports actual expiry distinctly", async () => {
    readSession.mockRejectedValueOnce(new PhysicalSessionError("session_expired", "Expired"));
    const response = await request();
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe("session_expired");
  });
  it("does not classify a missing session as expired", async () => {
    readSession.mockRejectedValueOnce(new PhysicalSessionError("session_not_found", "Not found"));
    const response = await request();
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("session_not_found");
  });
  it("treats storage or server failures as temporary, without exposing internals", async () => {
    readSession.mockRejectedValueOnce(new Error("Internal storage details"));
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "session_status_unavailable", error: "Unable to check the store session. Please retry." });
  });
  it("returns completed sessions without caching stale status", async () => {
    readSession.mockResolvedValueOnce({ session_id: "test", status: "completed" });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.json()).status).toBe("completed");
  });
});
