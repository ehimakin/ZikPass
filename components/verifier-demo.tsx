"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";
import { createPresentationBundle, loadWalletState } from "@/lib/client/wallet-client";
import { verifyPresentationBundle } from "@/lib/shared/verifier-sdk";
import type {
  PresentationBundle,
  SignedCredential,
  VerificationResult,
  WalletState
} from "@/lib/shared/types";

function buildChallenge(): string {
  return `vendor_gate_${crypto.randomUUID()}`;
}

function cloneCredential(credential: SignedCredential): SignedCredential {
  return JSON.parse(JSON.stringify(credential)) as SignedCredential;
}

export function VerifierDemo({ issuerPublicKey }: { issuerPublicKey: JsonWebKey }) {
  const [wallet, setWallet] = useState<WalletState>({});
  const [challenge, setChallenge] = useState("");
  const [bundle, setBundle] = useState<PresentationBundle | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [tamperPayload, setTamperPayload] = useState(false);
  const [simulateExpiry, setSimulateExpiry] = useState(false);
  const [breakHolderSignature, setBreakHolderSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setWallet(loadWalletState());
  }, []);

  function refreshWallet() {
    setWallet(loadWalletState());
    setError(null);
  }

  function verifyForAccess() {
    startTransition(() => {
      void (async () => {
        try {
          const freshWallet = loadWalletState();
          setWallet(freshWallet);

          if (!freshWallet.credential) {
            throw new Error("No Zik Pass found in this browser. Create one first.");
          }

          const nextChallenge = buildChallenge();
          setChallenge(nextChallenge);

          let credentialOverride = cloneCredential(freshWallet.credential);
          if (tamperPayload) {
            credentialOverride = {
              ...credentialOverride,
              payload: {
                ...credentialOverride.payload,
                over18: false
              }
            };
          }

          const nextBundle = await createPresentationBundle(nextChallenge, {
            credentialOverride,
            wrongChallenge: breakHolderSignature ? `${nextChallenge}_broken` : undefined
          });

          const verificationTime = simulateExpiry
            ? new Date(new Date(nextBundle.credential.payload.expires_at).getTime() + 1000)
            : new Date();

          const nextResult = await verifyPresentationBundle(
            nextBundle,
            issuerPublicKey,
            verificationTime
          );

          setBundle(nextBundle);
          setResult(nextResult);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Verification failed.");
          setResult(null);
          setBundle(null);
        }
      })();
    });
  }

  const accessGranted = result?.decision === "allow";

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(135deg,_#07140f_0%,_#0c251a_35%,_#133528_100%)] text-mist shadow-panel">
        <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime/90">
                Nightjar Bets
              </p>
              <h2 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
                Age-gated access with one Zik Pass check.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-mist/78 sm:text-base">
                This dummy adult-content vendor requests a fresh challenge, receives the wallet
                presentation, and validates the credential locally before allowing entry.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
                disabled={isPending}
                onClick={verifyForAccess}
              >
                Verify with Zik Pass
              </button>
              <button
                className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-mist hover:bg-white/15"
                onClick={refreshWallet}
              >
                Reload wallet
              </button>
              <Link
                className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-mist hover:bg-white/15"
                href="/wallet"
              >
                Get Zik Pass
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <VendorStat
                label="Wallet credential"
                value={wallet.credential ? "Available" : "Missing"}
                tone={wallet.credential ? "good" : "warn"}
              />
              <VendorStat
                label="Cooling-off"
                value={
                  wallet.credential
                    ? new Date(wallet.credential.payload.activates_at).getTime() <= Date.now()
                      ? "Complete"
                      : "In progress"
                    : "Unknown"
                }
                tone={
                  wallet.credential &&
                  new Date(wallet.credential.payload.activates_at).getTime() <= Date.now()
                    ? "good"
                    : "neutral"
                }
              />
              <VendorStat
                label="Last decision"
                value={result ? result.decision.toUpperCase() : "Pending"}
                tone={accessGranted ? "good" : result ? "warn" : "neutral"}
              />
            </div>
          </div>

          <div className="relative">
            <div
              className={`rounded-[32px] border p-6 transition ${
                accessGranted
                  ? "border-teal/30 bg-white/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className={`${accessGranted ? "" : "blur-[1px]"} space-y-4`}>
                <div className="rounded-[24px] bg-white/8 p-4">
                  <p className="font-heading text-xl font-semibold">Premier football markets</p>
                  <p className="mt-2 text-sm text-mist/72">
                    Live odds, accumulator builder, and in-play boosts unlock after age check.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] bg-white/8 p-4">
                    <p className="font-medium">Tonight’s boosted slip</p>
                    <p className="mt-2 text-sm text-mist/72">2.4x return on live combo picks.</p>
                  </div>
                  <div className="rounded-[24px] bg-white/8 p-4">
                    <p className="font-medium">Adults-only lounge</p>
                    <p className="mt-2 text-sm text-mist/72">
                      Restricted content stays locked until local verification succeeds.
                    </p>
                  </div>
                </div>
              </div>

              {!accessGranted ? (
                <div className="mt-5 rounded-[24px] bg-ink/65 p-5">
                  <p className="font-heading text-2xl font-semibold">Access locked</p>
                  <p className="mt-2 text-sm text-mist/78">
                    Verify an active Over-18 Zik Pass to continue into the gated experience.
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] bg-teal/18 p-5">
                  <p className="font-heading text-2xl font-semibold text-lime">Access granted</p>
                  <p className="mt-2 text-sm text-mist/85">
                    The vendor validated issuer trust, holder possession, claim integrity, and the
                    credential activation window locally.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard
          title="Verification breakdown"
          subtitle="The technical checks are still visible, but they sit behind the single vendor action."
        >
          {result ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={result.decision === "allow" ? "good" : "warn"}>
                  {result.decision === "allow" ? "Access granted" : "Access denied"}
                </StatusPill>
                <StatusPill tone={result.checks.issuer_signature_valid ? "good" : "warn"}>
                  Issuer signature {result.checks.issuer_signature_valid ? "valid" : "invalid"}
                </StatusPill>
                <StatusPill tone={result.checks.holder_signature_valid ? "good" : "warn"}>
                  Holder signature {result.checks.holder_signature_valid ? "valid" : "invalid"}
                </StatusPill>
                <StatusPill tone={result.checks.active ? "good" : "warn"}>
                  Credential {result.checks.active ? "active" : "inactive"}
                </StatusPill>
                <StatusPill tone={result.checks.not_expired ? "good" : "warn"}>
                  Credential {result.checks.not_expired ? "current" : "expired"}
                </StatusPill>
                <StatusPill tone={result.checks.claim_over18 ? "good" : "warn"}>
                  over18 {String(result.checks.claim_over18)}
                </StatusPill>
              </div>

              <div className="grid gap-3">
                <CheckLine
                  label="Issuer signature"
                  ok={result.checks.issuer_signature_valid}
                  detail="Checks the Zignature against the public issuer key."
                />
                <CheckLine
                  label="Holder challenge"
                  ok={result.checks.holder_signature_valid}
                  detail="Checks the nonce response against the subject public key in the credential."
                />
                <CheckLine
                  label="Activation window"
                  ok={result.checks.active}
                  detail="Ensures the cooling-off period has elapsed before access is granted."
                />
                <CheckLine
                  label="Expiry window"
                  ok={result.checks.not_expired}
                  detail="Ensures the credential has not passed its expiry date."
                />
                <CheckLine
                  label="Claim integrity"
                  ok={result.checks.claim_over18}
                  detail="Confirms the credential still asserts that the holder is over 18."
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink/65">
              Click <span className="font-medium">Verify with Zik Pass</span> to run the local
              vendor checks.
            </p>
          )}

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        </SurfaceCard>

        <div className="grid gap-6">
          <SurfaceCard
            title="Demo controls"
            subtitle="These remain available so denial cases can still be demonstrated quickly."
          >
            <div className="space-y-3 text-sm text-ink/75">
              <label className="flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3">
                <span>Tamper the credential payload</span>
                <input checked={tamperPayload} type="checkbox" onChange={() => setTamperPayload((v) => !v)} />
              </label>
              <label className="flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3">
                <span>Verify after expiry time</span>
                <input checked={simulateExpiry} type="checkbox" onChange={() => setSimulateExpiry((v) => !v)} />
              </label>
              <label className="flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3">
                <span>Break holder challenge signature</span>
                <input
                  checked={breakHolderSignature}
                  type="checkbox"
                  onChange={() => setBreakHolderSignature((v) => !v)}
                />
              </label>
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Challenge and bundle"
            subtitle="This is what the vendor generated and what the wallet presented."
          >
            {bundle ? (
              <div className="space-y-4">
                <div className="rounded-[24px] bg-ink p-4 text-mist">
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime">Challenge</p>
                  <p className="mt-2 break-all text-sm">{challenge}</p>
                </div>
                <pre className="rounded-[24px] bg-ink p-4 text-xs text-mist">
                  {JSON.stringify(bundle, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-ink/65">No presentation bundle yet.</p>
            )}
          </SurfaceCard>

          <SurfaceCard
            title="Issuer public key"
            subtitle="The vendor uses this trust root and does not call back to the issuer for the core decision."
          >
            <pre className="rounded-[24px] bg-ink p-4 text-xs text-mist">
              {JSON.stringify(issuerPublicKey, null, 2)}
            </pre>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

function VendorStat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div className="rounded-[24px] bg-white/8 p-4">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-mist/45">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-mist">{value}</p>
        <StatusPill tone={tone}>{value}</StatusPill>
      </div>
    </div>
  );
}

function CheckLine({
  label,
  detail,
  ok
}: {
  label: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-[24px] bg-ink/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-ink">{label}</p>
        <StatusPill tone={ok ? "good" : "warn"}>{ok ? "Pass" : "Fail"}</StatusPill>
      </div>
      <p className="mt-2 text-sm text-ink/70">{detail}</p>
    </div>
  );
}
