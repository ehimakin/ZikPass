import { describe, expect, it } from "vitest";
import { affiliateRows, desktopAffiliateCapacity, shuffleAffiliates } from "../lib/shared/affiliate-layout";

describe("affiliate layout", () => {
  it("keeps partial rows above full rows without dropping logos", () => {
    for (let count = 0; count < 150; count++) {
      const logos = Array.from({ length: count }, (_, index) => index);
      const rows = affiliateRows(logos);
      expect(rows.flat()).toEqual(logos);
      expect(rows.every((row) => row.length <= 4)).toBe(true);
      expect(rows.slice(1).every((row) => row.length === 4)).toBe(true);
    }
    expect(affiliateRows(Array.from({ length: 11 })).map((row) => row.length)).toEqual([3, 4, 4]);
  });
  it("limits rows to the usable viewport and handles very short windows", () => {
    expect(desktopAffiliateCapacity(900, 64)).toBe(56);
    expect(desktopAffiliateCapacity(200, 64)).toBe(0);
    expect(desktopAffiliateCapacity(600, 100)).toBeLessThan(desktopAffiliateCapacity(600, 64));
  });
  it("shuffles without mutating, losing or duplicating affiliates", () => {
    const pool = Array.from({ length: 101 }, (_, index) => index);
    const result = shuffleAffiliates(pool);
    expect([...result].sort((a, b) => a - b)).toEqual(pool);
    expect(pool[0]).toBe(0);
    expect(shuffleAffiliates([])).toEqual([]);
  });
});
