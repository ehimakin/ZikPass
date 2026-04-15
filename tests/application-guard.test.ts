import { describe, expect, it } from "vitest";
import { buildApplicationFingerprint } from "@/lib/server/application-guard";

describe("buildApplicationFingerprint", () => {
  it("is stable across whitespace and casing differences", () => {
    const a = buildApplicationFingerprint({
      first_name: "Alice ",
      last_name: " Example",
      date_of_birth: "1995-01-01",
      current_home_address: "10 High Street",
      previous_address: "1 Old Road"
    });

    const b = buildApplicationFingerprint({
      first_name: " alice",
      last_name: "EXAMPLE ",
      date_of_birth: "1995-01-01",
      current_home_address: "10   High   Street",
      previous_address: "1 OLD ROAD"
    });

    expect(a).toBe(b);
  });

  it("changes when the matched identity inputs change", () => {
    const a = buildApplicationFingerprint({
      first_name: "Alice",
      last_name: "Example",
      date_of_birth: "1995-01-01",
      current_home_address: "10 High Street"
    });

    const b = buildApplicationFingerprint({
      first_name: "Alice",
      last_name: "Example",
      date_of_birth: "1995-01-01",
      current_home_address: "11 High Street"
    });

    expect(a).not.toBe(b);
  });
});
