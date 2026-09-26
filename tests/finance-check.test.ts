import { beforeEach, describe, expect, it, vi } from "vitest";
import { financeCheckGateway, financeStatus } from "@/lib/client/finance-check";

describe("finance preview boundary", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    vi.useFakeTimers();
  });
  it("persists the cooling-off period and resumes without another payment", async () => {
    const pending = financeCheckGateway.checkout();
    await vi.advanceTimersByTimeAsync(1200);
    const record = await pending;
    expect(financeStatus(record)).toBe("pending");
    expect(financeCheckGateway.load()).toEqual(record);
    expect(await financeCheckGateway.checkout()).toEqual(record);
    await vi.advanceTimersByTimeAsync(30000);
    expect(financeStatus(record)).toBe("approved");
    expect(record.mode).toBe("preview");
    expect(record).not.toHaveProperty("credential");
    vi.useRealTimers();
  });
  it("rejects malformed saved progress", () => {
    localStorage.setItem("zik-finance-application-v1", '{"version":1,"mode":"preview","readyAt":"bad"}');
    expect(financeCheckGateway.load()).toBeNull();
    vi.useRealTimers();
  });
});
