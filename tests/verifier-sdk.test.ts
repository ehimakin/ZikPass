import { describe, expect, it } from "vitest";
import { serializeCredentialPayload } from "@/lib/shared/credential-format";
import { generateKeyPair, signString } from "@/lib/shared/crypto/ed25519";
import type { AgeCredential, PresentationBundle } from "@/lib/shared/types";
import { verifyPresentationBundle } from "@/lib/shared/verifier-sdk";

async function buildBundle(): Promise<{
  bundle: PresentationBundle;
  issuerPublicKey: JsonWebKey;
}> {
  const issuerKeys = await generateKeyPair();
  const holderKeys = await generateKeyPair();
  const challenge = "challenge_demo";

  const payload: AgeCredential = {
    credential_id: "zp_demo123",
    over18: true,
    issuer: "Zik Pass",
    issued_at: "2026-04-08T12:00:00.000Z",
    activates_at: "2026-04-08T12:01:00.000Z",
    expires_at: "2027-04-08T12:00:00.000Z",
    assurance_level: "remote_standard",
    issuance_channel: "remote",
    verification_method: "remote_financial",
    subject_public_key: holderKeys.publicKeyJwk
  };

  const bundle: PresentationBundle = {
    credential: {
      payload,
      zignature: await signString(
        issuerKeys.privateKeyJwk,
        serializeCredentialPayload(payload)
      ),
      algorithm: "Ed25519"
    },
    challenge,
    holder_signature: await signString(holderKeys.privateKeyJwk, challenge),
    holder_algorithm: "Ed25519",
    presented_at: "2026-04-08T12:01:00.000Z"
  };

  return { bundle, issuerPublicKey: issuerKeys.publicKeyJwk };
}

describe("verifyPresentationBundle", () => {
  it("allows a valid credential and holder response", async () => {
    const { bundle, issuerPublicKey } = await buildBundle();
    const result = await verifyPresentationBundle(
      bundle,
      issuerPublicKey,
      new Date("2026-04-08T12:02:00.000Z")
    );

    expect(result.decision).toBe("allow");
    expect(result.checks.issuer_signature_valid).toBe(true);
    expect(result.checks.holder_signature_valid).toBe(true);
    expect(result.checks.active).toBe(true);
    expect(result.checks.not_expired).toBe(true);
    expect(result.checks.claim_over18).toBe(true);
  });

  it("denies a tampered payload even if the holder signature still verifies", async () => {
    const { bundle, issuerPublicKey } = await buildBundle();
    bundle.credential.payload.over18 = false;

    const result = await verifyPresentationBundle(
      bundle,
      issuerPublicKey,
      new Date("2026-04-08T12:02:00.000Z")
    );

    expect(result.decision).toBe("deny");
    expect(result.checks.issuer_signature_valid).toBe(false);
    expect(result.checks.active).toBe(true);
    expect(result.checks.claim_over18).toBe(false);
  });

  it("denies an otherwise valid credential after expiry", async () => {
    const { bundle, issuerPublicKey } = await buildBundle();

    const result = await verifyPresentationBundle(
      bundle,
      issuerPublicKey,
      new Date("2028-04-08T12:02:00.000Z")
    );

    expect(result.decision).toBe("deny");
    expect(result.checks.issuer_signature_valid).toBe(true);
    expect(result.checks.not_expired).toBe(false);
  });

  it("denies a credential that is still in cooling-off", async () => {
    const { bundle, issuerPublicKey } = await buildBundle();

    const result = await verifyPresentationBundle(
      bundle,
      issuerPublicKey,
      new Date("2026-04-08T12:00:30.000Z")
    );

    expect(result.decision).toBe("deny");
    expect(result.checks.issuer_signature_valid).toBe(true);
    expect(result.checks.active).toBe(false);
  });
});
