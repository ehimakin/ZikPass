"use client";

import { parseAgeConsent, type AgeConsentV1 } from "@/lib/shared/age-consent";
import { useEffect, useState } from "react";
import type { Route } from "next";
import { Zignature } from "@/components/zignature";
import { createPresentationBundle, loadWalletState } from "@/lib/client/wallet-client";
import { buildCredentialZignatureSeedInput } from "@/lib/shared/zignature";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";
import type { WalletState } from "@/lib/shared/types";
import { Alert, Button, ButtonLink, Card } from "@/components/customer/ui";
import { ShieldIcon } from "@/components/customer/icons";
import { ZikLogoMark } from "@/components/zik-logo";
import { environmentBadgeLabel } from "@/lib/shared/demo-environment";



interface ApiError {
  error: string;
}

interface PendingAuthorization {
  consent: AgeConsentV1;
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
  const [clientName, setClientName] = useState("Requesting site");
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

        authorization.consent = parseAgeConsent(authorization.consent);
        if (authorization.consent.request_id !== requestId || Date.parse(authorization.consent.expires_at) <= Date.now()) throw new Error("expired");
        setClientName(authorization.consent.display_name);
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
        setMessage(`Zik checks your signed age pass. ${authorization.consent.display_name} receives an over-18 result and verification timestamps. Your Vault is not accessed.`);
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
        ? `Verified. Returning to ${clientName}.`
        : `Zik could not confirm an active over-18 pass. Returning to ${clientName}.`
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
    setMessage(`Checking your pass on this device and preparing a minimal result for ${clientName}.`);

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

  const busy = flowState === "approving" || flowState === "resolved";

  return (
    <main className="zk-surface flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--zk-canvas)] px-4 py-8">
      <div className="w-full max-w-[420px]">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ZikLogoMark className="h-7 w-7 shrink-0" />
            <span className="text-[15px] font-extrabold tracking-tight text-[var(--zk-text)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fadb2050857d-1" : undefined}>Zik Pass</span>
          </span>
          <span className="rounded-full bg-[var(--zk-sunken)] px-2.5 py-1 text-[11px] font-semibold text-[var(--zk-text-soft)]">
            {environmentBadgeLabel()}
          </span>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--zk-line)] p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fadb2050857d-2" : undefined}>
              Age check requested by
            </p>
            <p className="text-xs" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fadb2050857d-3" : undefined}>Consent v1 · Required: age over 18 · Zik verified</p>
            <p className="mt-1 text-[18px] font-extrabold text-[var(--zk-text)]">{clientName}</p>
            <div className="mt-4 space-y-2">
              <ShareRow label="Shared" value="Over 18 result and verification metadata" tone="share" />
              <ShareRow label="Not shared" value="Name, date of birth, photo, ID number" tone="hold" />
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-start gap-3">
              <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--zk-positive)]" />
              <div className="min-w-0">
                <h1 className="text-[16px] font-bold text-[var(--zk-text)]">
                  {headingForState(flowState)}
                </h1>
                <p aria-live="polite" className="mt-1 text-[13px] leading-snug text-[var(--zk-text-soft)]">
                  {message}
                </p>
              </div>
            </div>

            {wallet.credential ? (
              <div className="mt-4 rounded-[var(--zk-r-md)] bg-[var(--zk-sunken)] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fadb2050857d-4" : undefined}>
                  Your pass &middot; visual only
                </p>
                <Zignature
                  className="mt-1.5 h-14 w-full"
                  seedInput={zignatureSeed}
                  stroke="#0E1726"
                  strokeWidth={3}
                  variant="compact"
                  width={220}
                  height={56}
                />
              </div>
            ) : null}

            <div className="mt-5 space-y-2">
              {flowState === "ready" ? (
                <>
                  <Button size="lg" loading={busy} onClick={() => void approve()}>
                    Confirm I&rsquo;m over 18
                  </Button>
                  <Button size="lg" variant="ghost" disabled={busy} onClick={cancel}>
                    Cancel
                  </Button>
                </>
              ) : null}

              {flowState === "missing" || flowState === "expired" || flowState === "unavailable" ? (
                <>
                  <div className={flowState === "missing" ? "zk-lifted-pass-button" : undefined}>
                    <ButtonLink href={(flowState === "missing" ? "/find" : "/pass") as Route} size="lg">
                      {flowState === "missing" ? "Get Zik Pass" : "Open my pass"}
                    </ButtonLink>
                  </div>
                  <Button size="lg" variant="ghost" disabled={busy} onClick={returnMissingState}>
                    Back to {clientName}
                  </Button>
                </>
              ) : null}

              {flowState === "not_found" ? (
                <Alert tone="critical">{message ?? "This verification link is no longer valid."}</Alert>
              ) : null}
            </div>
          </div>
        </Card>

        <p className="mt-4 px-1 text-center text-[12px] leading-relaxed text-[var(--zk-text-faint)]">
          Zik checks your pass on this device and sends {clientName} a one-time signed
          result. Denials look the same whether or not you have a pass.
        </p>
      </div>
    </main>
  );
}

function ShareRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "share" | "hold";
}) {
  return (
    <div className="flex items-start gap-2.5 text-[13px]">
      <span
        className={
          "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white " +
          (tone === "share" ? "bg-[var(--zk-positive)]" : "bg-[var(--zk-text-faint)]")
        }
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {tone === "share" ? <path d="m5 12.5 4.5 4.5L19 7" /> : <path d="M6 6 18 18M18 6 6 18" />}
        </svg>
      </span>
      <span>
        <span className="font-semibold text-[var(--zk-text)]">{label}: </span>
        <span className="text-[var(--zk-text-soft)]">{value}</span>
      </span>
    </div>
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
      return "Returning to the requesting site";
    case "not_found":
      return "Verification unavailable";
  }
}
