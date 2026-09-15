import { describe, expect, test } from "vitest";
import {
  createOperatorSession,
  OPERATOR_SESSION_TTL_MS,
  readOperatorSession,
  verifyOperatorLoginCode
} from "@/lib/server/operator-session";

describe("operator store login", () => {
  test("accepts the development code and rejects other codes", () => {
    expect(verifyOperatorLoginCode("8640")).toBe(true);
    expect(verifyOperatorLoginCode("8641")).toBe(false);
    expect(verifyOperatorLoginCode("")).toBe(false);
  });

  test("creates a signed session bound to the selected store", async () => {
    const now = Date.now();
    const created = await createOperatorSession("zik-london-003", now);
    const session = await readOperatorSession(created.token, now + 1);
    expect(session?.storeId).toBe("zik-london-003");
    expect(session?.expiresAt).toBe(now + OPERATOR_SESSION_TTL_MS);
  });

  test("rejects tampered, expired, and invalid-store sessions", async () => {
    const now = Date.now();
    const created = await createOperatorSession("zik-london-001", now);
    const [payload, signature] = created.token.split(".");
    // Change significant signature bits, not the final base64 padding bits.
    const tamperedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(await readOperatorSession(`${payload}.${tamperedSignature}`, now + 1)).toBeNull();
    expect(await readOperatorSession(created.token, now + OPERATOR_SESSION_TTL_MS)).toBeNull();
    await expect(createOperatorSession("not-a-store", now)).rejects.toThrow("valid store");
  });
});
