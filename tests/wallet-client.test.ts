import { describe, expect, it } from "vitest";
import { normalizeWalletState } from "@/lib/client/wallet-client";

describe("normalizeWalletState", () => {
  it("returns an empty wallet for malformed persisted state", () => {
    expect(normalizeWalletState(null)).toEqual({});
    expect(normalizeWalletState("bad-data")).toEqual({});
    expect(
      normalizeWalletState({
        credential: {
          payload: {
            credential_id: "zp_bad"
          }
        }
      })
    ).toEqual({});
  });

  it("preserves valid credential, keypair, and wallet state fields", () => {
    const wallet = normalizeWalletState({
      enrollmentId: "enroll_123",
      localCredentialStoredAt: "2026-04-13T12:00:00.000Z",
      holderKeyPair: {
        publicKeyJwk: { kty: "OKP" },
        privateKeyJwk: { kty: "OKP" }
      },
      credential: {
        payload: {
          credential_id: "zp_demo123",
          over18: true,
          issuer: "Zik Pass",
          issued_at: "2026-04-13T12:00:00.000Z",
          activates_at: "2026-04-13T12:01:00.000Z",
          expires_at: "2027-04-13T12:00:00.000Z",
          assurance_level: "remote_standard",
          issuance_channel: "remote",
          verification_method: "remote_financial",
          subject_public_key: { kty: "OKP" }
        },
        zignature: "sig_demo",
        algorithm: "Ed25519"
      }
    });

    expect(wallet.enrollmentId).toBe("enroll_123");
    expect(wallet.localCredentialStoredAt).toBe("2026-04-13T12:00:00.000Z");
    expect(wallet.holderKeyPair?.publicKeyJwk).toEqual({ kty: "OKP" });
    expect(wallet.credential?.payload.credential_id).toBe("zp_demo123");
  });
});
