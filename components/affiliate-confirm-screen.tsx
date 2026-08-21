"use client";

import { useEffect, useState } from "react";
import { Zignature } from "@/components/zignature";
import { createPresentationBundle, loadWalletState } from "@/lib/client/wallet-client";
import { buildCredentialZignatureSeedInput } from "@/lib/shared/zignature";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";
import type { WalletState } from "@/lib/shared/types";

interface ApiError {
  error: string;
}

interface PendingAuthorization {
  status: string;
  redirect_uri: string;
  challenge?: string;
}

type ConfirmFlowState =
  | "loading"
  | "ready"
  | "missing"
  | "expired"
  | "unavailable"
  | "approving"
  | "resolved"
  | "not_found";

export function AffiliateConfirmScreen({ requestId }: { requestId: string }) {
  const [wallet, setWallet] = useState<WalletState>({});
  const [pending, setPending] = useState<PendingAuthorization | null>(null);
  const [flowState, setFlowState] = useState<ConfirmFlowState>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/affiliate/result/${encodeURIComponent(requestId)}`);
        const data = (await response.json()) as PendingAuthorization | ApiError;

        if (!response.ok) {
          setFlowState("not_found");
          setMessage((data as ApiError).error ?? "This verification link is no longer valid.");
          return;
        }

        const authorization = data as PendingAuthorization;

        if (authorization.status !== "pending" || !authorization.challenge) {
          setFlowState("not_found");
          setMessage("This verification request has already been completed or is no longer active.");
          return;
        }

        setPending(authorization);

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
        setFlowState("not_found");
        setMessage("Verification is unavailable in this browser session right now.");
      }
    })();
  }, [requestId]);

  const zignatureSeed = wallet.credential
    ? buildCredentialZignatureSeedInput({
        credentialId: wallet.credential.payload.credential_id,
        subjectPublicKey: wallet.credential.payload.subject_public_key
      })
    : `affiliate:${requestId}`;

  async function resolveAndReturn(
    body: { request_id: string; presentation_bundle?: unknown } | { request_id: string; denial_reason: string }
  ) {
    const response = await fetch("/api/affiliate/challenge/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const outcome = (await response.json()) as
      | { outcome: "approved"; redirectUri: string; code: string; state: string }
      | { outcome: "denied"; redirectUri: string; state: string; reason: string }
      | ApiError;

    if (!response.ok || !("outcome" in outcome)) {
      setFlowState("not_found");
      setMessage((outcome as ApiError).error ?? "Verification could not complete.");
      return;
    }

    setFlowState("resolved");
    setMessage(
      outcome.outcome === "approved"
        ? "Verification successful. Returning to Nightfall."
        : "Zik could not confirm an active over-18 pass for this request. Returning to Nightfall."
    );

    const params = new URLSearchParams({ state: outcome.state });
    if (outcome.outcome === "approved") {
      params.set("code", outcome.code);
    }

    window.setTimeout(() => {
      window.location.href = `${outcome.redirectUri}?${params.toString()}`;
    }, 700);
  }

  async function approve() {
    if (!pending?.challenge) {
      return;
    }

    setFlowState("approving");
    setMessage("Verifying your pass locally and preparing a minimal result for Nightfall.");

    try {
      const bundle = await createPresentationBundle(pending.challenge);
      await resolveAndReturn({ request_id: requestId, presentation_bundle: bundle });
    } catch {
      await resolveAndReturn({ request_id: requestId, denial_reason: "unsupported_device" });
    }
  }

  function cancel() {
    setFlowState("approving");
    setMessage("Cancelling…");
    void resolveAndReturn({ request_id: requestId, denial_reason: "cancelled" });
  }

  function returnMissingState() {
    const reason = flowState === "expired" ? "expired_pass" : flowState === "unavailable" ? "revoked_or_invalid_pass" : "no_pass";
    setFlowState("approving");
    void resolveAndReturn({ request_id: requestId, denial_reason: reason });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.22),_rgba(8,16,13,0.96)_48%)] px-4 py-6 text-mist sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[36px] border border-white/10 bg-[linear-gradient(160deg,_rgba(10,22,17,0.98),_rgba(15,35,27,0.96))] shadow-[0_40px_120px_rgba(6,12,10,0.46)] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border-b border-white/8 p-8 lg:border-b-0 lg:border-r">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime/78">Hosted by Zik · Demo</p>
            <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight">Verify age for Nightfall</h1>
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
                  <p className="mt-2 text-lg font-medium text-mist">Nightfall</p>
                  <p className="mt-1 text-sm text-mist/62">Confirm only: over 18</p>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/8 bg-[#0f1d17] px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mist/50">Your Zignature</p>
                <p className="mt-1 text-sm text-mist/68">Visual only. Not part of the proof.</p>
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
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-mist/50">Zik decision</p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">{headingForState(flowState)}</h2>
              <p aria-live="polite" className="mt-3 text-sm leading-7 text-mist/72">
                {message}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                {flowState === "ready" ? (
                  <>
                    <button
                      className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                      onClick={() => void approve()}
                      type="button"
                    >
                      Approve for Nightfall
                    </button>
                    <button
                      className="rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      onClick={cancel}
                      type="button"
                    >
                      Cancel
                    </button>
                  </>
                ) : null}

                {flowState === "missing" || flowState === "expired" || flowState === "unavailable" ? (
                  <>
                    <a
                      className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink"
                      href="/wallet"
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Zik wallet
                    </a>
                    <button
                      className="rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-medium text-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      onClick={returnMissingState}
                      type="button"
                    >
                      Return to Nightfall
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function headingForState(state: ConfirmFlowState): string {
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
    case "approving":
      return "Verifying locally";
    case "resolved":
      return "Returning to Nightfall";
    case "not_found":
      return "Verification unavailable";
  }
}
