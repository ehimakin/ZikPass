"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Zignature } from "@/components/zignature";
import { createPresentationBundle, loadWalletState } from "@/lib/client/wallet-client";
import type { WalletState } from "@/lib/shared/types";
import { buildCredentialZignatureSeedInput } from "@/lib/shared/zignature";
import {
  createVendorVerificationMessage,
  createVendorVerificationResult,
  type VendorVerificationResult,
  type VendorVerificationSession
} from "@/lib/shared/vendor-verification";
import { verifyPresentationBundle } from "@/lib/shared/verifier-sdk";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";

type HostedFlowState =
  | "loading"
  | "ready"
  | "missing"
  | "expired"
  | "unavailable"
  | "verifying"
  | "verified"
  | "denied"
  | "cancelled";

export function ZikHostedVerification({
  issuerPublicKey,
  session
}: {
  issuerPublicKey: JsonWebKey;
  session: VendorVerificationSession;
}) {
  const [wallet, setWallet] = useState<WalletState>({});
  const [flowState, setFlowState] = useState<HostedFlowState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [outboundResult, setOutboundResult] = useState<VendorVerificationResult | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      try {
        const nextWallet = await loadWalletState();
        setWallet(nextWallet);

        const snapshot = getWalletStatusSnapshot(nextWallet, null, new Date());

        if (!nextWallet.credential) {
          setFlowState("missing");
          setMessage("No valid Zik Pass was found on this device.");
          return;
        }

        if (snapshot.credential_expired || snapshot.status === "pass_expired") {
          setFlowState("expired");
          setMessage("The Zik Pass on this device has expired and cannot be used for verification.");
          return;
        }

        if (!snapshot.has_holder_key || !snapshot.has_credential || !snapshot.credential_active) {
          setFlowState("unavailable");
          setMessage(
            "Verification is unavailable because this device does not currently hold an active, usable Zik Pass."
          );
          return;
        }

        setFlowState("ready");
        setMessage("Zik will confirm only that you are over 18. No identity information will be shared.");
      } catch {
        setFlowState("unavailable");
        setMessage("Verification is unavailable in this browser session right now.");
      }
    })();
  }, []);

  const zignatureSeed = useMemo(() => {
    if (!wallet.credential) {
      return `${session.vendor_name}:${session.session_id}`;
    }

    return buildCredentialZignatureSeedInput({
      credentialId: wallet.credential.payload.credential_id,
      subjectPublicKey: wallet.credential.payload.subject_public_key
    });
  }, [session.session_id, session.vendor_name, wallet.credential]);

  function approve() {
    startTransition(() => {
      void (async () => {
        setFlowState("verifying");
        setMessage("Verifying your pass locally and preparing a minimal result for the vendor.");

        try {
          const challenge = `zik_vendor_${session.session_id}_${crypto.randomUUID()}`;
          const bundle = await createPresentationBundle(challenge);
          const verification = await verifyPresentationBundle(bundle, issuerPublicKey, new Date());

          if (verification.decision === "allow") {
            const result = createVendorVerificationResult(session, {
              verified: true,
              over18: true,
              credential_status: "active",
              outcome: "verified",
              assurance_level: bundle.credential.payload.assurance_level
            });

            setOutboundResult(result);
            setFlowState("verified");
            setMessage(`Verification successful. Returning to ${session.vendor_name}.`);
            window.setTimeout(() => {
              postResult(session, result);
            }, 700);
            return;
          }

          const deniedStatus = !verification.checks.not_expired
            ? "expired"
            : verification.checks.active
              ? "denied"
              : "invalid";
          const deniedOutcome = !verification.checks.not_expired
            ? "expired_pass"
            : verification.checks.active
              ? "denied"
              : "invalid_pass";
          const result = createVendorVerificationResult(session, {
            verified: false,
            over18: false,
            credential_status: deniedStatus,
            outcome: deniedOutcome
          });

          setOutboundResult(result);
          setFlowState("denied");
          setMessage("Zik could not confirm an active over-18 pass for this request.");
          window.setTimeout(() => {
            postResult(session, result);
          }, 700);
        } catch {
          const result = createVendorVerificationResult(session, {
            verified: false,
            over18: false,
            credential_status: "invalid",
            outcome: "invalid_pass"
          });

          setOutboundResult(result);
          setFlowState("denied");
          setMessage("Verification could not complete because the local pass material was unavailable.");
          window.setTimeout(() => {
            postResult(session, result);
          }, 700);
        }
      })();
    });
  }

  function cancel() {
    const result = createVendorVerificationResult(session, {
      verified: false,
      over18: false,
      credential_status: "cancelled",
      outcome: "cancelled"
    });

    setOutboundResult(result);
    setFlowState("cancelled");
    setMessage(`Verification was cancelled. Returning to ${session.vendor_name}.`);
    window.setTimeout(() => {
      postResult(session, result);
    }, 250);
  }

  function returnMissingState() {
    const result = createVendorVerificationResult(session, {
      verified: false,
      over18: false,
      credential_status:
        flowState === "expired" ? "expired" : flowState === "unavailable" ? "invalid" : "missing",
      outcome:
        flowState === "expired"
          ? "expired_pass"
          : flowState === "unavailable"
            ? "invalid_pass"
            : "no_pass"
    });

    setOutboundResult(result);
    postResult(session, result);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.22),_rgba(8,16,13,0.96)_48%)] px-4 py-6 text-mist sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(160deg,_rgba(10,22,17,0.98),_rgba(15,35,27,0.96))] shadow-[0_40px_120px_rgba(6,12,10,0.46)] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-white/8 p-8 lg:border-b-0 lg:border-r">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime/78">Hosted by Zik</p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight">
              Verify age for {session.vendor_name}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-mist/74">
              This site is requesting confirmation that you are over 18. Zik will return only a
              minimal verification result and will not share your identity.
            </p>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-mist/48">
                    Verification request
                  </p>
                  <p className="mt-2 text-lg font-medium text-mist">{session.vendor_name}</p>
                  <p className="mt-1 text-sm text-mist/62">Confirm only: over 18</p>
                </div>
                <span className="rounded-full border border-lime/25 bg-lime/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-lime/90">
                  Session {session.session_id ? session.session_id.slice(0, 8) : "unknown"}
                </span>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/8 bg-[#0f1d17] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mist/50">
                      Your Zignature
                    </p>
                    <p className="mt-1 text-sm text-mist/68">Visual only. Not part of the proof.</p>
                  </div>
                </div>
                <Zignature
                  className="mt-3 h-20 w-full"
                  seedInput={zignatureSeed}
                  stroke="#d7f171"
                  strokeWidth={3}
                  variant="compact"
                  width={220}
                  height={72}
                />
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="rounded-[30px] border border-white/8 bg-white/[0.04] p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-mist/50">
                Zik decision
              </p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">
                {headingForState(flowState)}
              </h2>
              <p className="mt-3 text-sm leading-7 text-mist/72">{message}</p>

              <div className="mt-6 grid gap-3 rounded-[24px] bg-ink/35 p-4">
                <DetailRow label="Vendor" value={session.vendor_name} />
                <DetailRow label="Request" value="Confirm over 18" />
                <DetailRow
                  label="Data shared"
                  value={outboundResult?.verified ? "Over-18 confirmation only" : "No identity data"}
                />
                <DetailRow
                  label="Credential status"
                  value={wallet.credential ? currentCredentialLabel(flowState) : "No pass on device"}
                />
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                {flowState === "ready" ? (
                  <>
                    <button
                      className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink disabled:opacity-50"
                      disabled={isPending}
                      onClick={approve}
                    >
                      Approve for {session.vendor_name}
                    </button>
                    <button
                      className="rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-mist"
                      onClick={cancel}
                    >
                      Cancel
                    </button>
                  </>
                ) : null}

                {(flowState === "missing" || flowState === "expired" || flowState === "unavailable") ? (
                  <>
                    <Link
                      className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink"
                      href="/wallet"
                      target="_blank"
                    >
                      Open Zik wallet
                    </Link>
                    <button
                      className="rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-mist"
                      onClick={returnMissingState}
                    >
                      Return to {session.vendor_name}
                    </button>
                  </>
                ) : null}

                {(flowState === "verified" || flowState === "denied" || flowState === "cancelled") ? (
                  <button
                    className="rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-mist"
                    onClick={() => outboundResult && postResult(session, outboundResult)}
                  >
                    Return now
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function headingForState(state: HostedFlowState): string {
  switch (state) {
    case "loading":
      return "Checking this device";
    case "ready":
      return "Approve with Zik Pass";
    case "missing":
      return "No Zik Pass found";
    case "expired":
      return "Pass expired";
    case "unavailable":
      return "Verification unavailable";
    case "verifying":
      return "Verifying locally";
    case "verified":
      return "Verification successful";
    case "denied":
      return "Verification denied";
    case "cancelled":
      return "Verification cancelled";
  }
}

function currentCredentialLabel(state: HostedFlowState): string {
  switch (state) {
    case "verified":
    case "ready":
    case "verifying":
      return "Active";
    case "expired":
      return "Expired";
    case "unavailable":
    case "denied":
      return "Invalid or unavailable";
    default:
      return "Not available";
  }
}

function postResult(session: VendorVerificationSession, result: VendorVerificationResult) {
  const message = createVendorVerificationMessage(result);
  const targetOrigin = session.vendor_origin || window.location.origin;

  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, targetOrigin);
  }

  if (window.opener) {
    window.opener.postMessage(message, targetOrigin);
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="text-mist/58">{label}</p>
      <p className="font-medium text-mist">{value}</p>
    </div>
  );
}
