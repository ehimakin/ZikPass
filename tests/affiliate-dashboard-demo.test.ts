import { describe, expect, it } from "vitest";
import { allocationHistory, calculateAllocation, simulateAllocation } from "@/lib/demo/affiliate-dashboard";
describe("illustrative affiliate allocation", () => {
  it("reconciles nested participant splits to gross", () => {
    const result = calculateAllocation(10000, 2, 200);
    expect(result.zik).toBe(4000);
    expect(result.participants).toBe(6000);
    expect(result.store).toBe(2700);
    expect(result.pool).toBeCloseTo(3300);
    expect(result.share).toBe(.01);
    expect(result.allocation).toBeCloseTo(33);
    expect(result.zik + result.store + result.pool).toBeCloseTo(10000);
    expect(result.store / result.participants).toBeCloseTo(.45);
    expect(result.pool / result.participants).toBeCloseTo(.55);
  });
  it("dilutes the share as affiliates join while preserving founding weight", () => {
    expect(simulateAllocation(10000, 200).share).toBe(.005);
    expect(simulateAllocation(10000, 200).allocation).toBeCloseTo(16.5);
    expect(simulateAllocation(20000, 200).allocation).toBeCloseTo(33);
    expect(simulateAllocation(0, 800).allocation).toBe(0);
  });
  it("reconciles every historical fixture", () => {
    const expected = [33, 26.4, 24.75];
    allocationHistory.forEach((row, index) => expect(calculateAllocation(row.gross, 2, row.totalWeight).allocation).toBeCloseTo(expected[index]));
  });
  it("rejects invalid financial and weight inputs", () => {
    for (const args of [[-1,2,200], [NaN,2,200], [100,0,200], [100,2,1], [100,2,Infinity]]) expect(() => calculateAllocation(...args as [number,number,number])).toThrow(RangeError);
    expect(() => simulateAllocation(100, -1)).toThrow(RangeError);
    expect(() => simulateAllocation(100, 1.5)).toThrow(RangeError);
  });
});
