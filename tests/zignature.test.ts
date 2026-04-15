import { describe, expect, it } from "vitest";
import {
  buildCredentialZignatureSeedInput,
  generateZignaturePathData,
  generateZignaturePoints
} from "@/lib/shared/zignature";

describe("zignature generation", () => {
  it("returns the same path for the same seed input", () => {
    const first = generateZignaturePathData("zp_demo123:holder-demo");
    const second = generateZignaturePathData("zp_demo123:holder-demo");

    expect(first).toBe(second);
  });

  it("returns different paths for different seed inputs", () => {
    const first = generateZignaturePathData("zp_demo123:holder-demo");
    const second = generateZignaturePathData("zp_demo456:holder-demo");

    expect(first).not.toBe(second);
  });

  it("keeps generated points within the configured viewBox bounds", () => {
    const width = 320;
    const height = 96;
    const points = generateZignaturePoints("zp_demo123:holder-demo", {
      width,
      height,
      variant: "full"
    });

    expect(points[0].x).toBeGreaterThanOrEqual(0);
    expect(points.at(-1)?.x).toBeLessThanOrEqual(width);

    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(height);
    }
  });

  it("introduces at least one local loop or backtrack segment in the sampled line", () => {
    const points = generateZignaturePoints("zp_demo123:holder-demo", {
      width: 320,
      height: 96,
      variant: "full"
    });

    const hasBacktrack = points.some((point, index) => {
      if (index === 0) {
        return false;
      }

      return point.x < points[index - 1].x;
    });

    expect(hasBacktrack).toBe(true);
  });

  it("builds a stable credential seed input from the credential id and public key", () => {
    const first = buildCredentialZignatureSeedInput({
      credentialId: "zp_demo123",
      subjectPublicKey: {
        x: "abc",
        kty: "OKP",
        crv: "Ed25519"
      }
    });

    const second = buildCredentialZignatureSeedInput({
      credentialId: "zp_demo123",
      subjectPublicKey: {
        crv: "Ed25519",
        x: "abc",
        kty: "OKP"
      }
    });

    expect(first).toBe(second);
  });
});
