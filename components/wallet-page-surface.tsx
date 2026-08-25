"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import { PassPreviewCard } from "@/components/wallet-surface";
import { ExtendPassPanel } from "@/components/extend-pass-panel";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { RecoveryPanel } from "@/components/recovery-panel";
import { claimPwaHandoff, clearWallet, loadWalletState, storeCredential } from "@/lib/client/wallet-client";
import { StatusPill } from "@/components/status-pill";
import { classifyError } from "@/lib/shared/errors";
import type { ErrorCode } from "@/lib/shared/errors";
import { buildAppOnboardingUrl, formatIssuanceChannel } from "@/lib/shared/physical-flow";
import { buildCredentialZignatureSeedInput } from "@/lib/shared/zignature";
import type { EnrollmentRecord, WalletState } from "@/lib/shared/types";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";

const affiliateMarks = ["PHub", "XVideos", "Redtube"];

interface ApiError {
  error: string;
}

export function WalletPageSurface() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isStatusDockOpen, setIsStatusDockOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isPending, setIsPending] = useState(false);
  const [deleteButtonState, setDeleteButtonState] = useState<"idle" | "deleted">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorRecoveryAction, setErrorRecoveryAction] = useState<
    ReturnType<typeof classifyError>["recoveryAction"]
  >("retry");

  const loadWallet = useCallback(async () => {
    setError(null);

    // A failure reading local storage genuinely has nothing to preserve;
    // any other failure below keeps whatever wallet state was already
    // loaded here, so a lost response or duplicate-claim error can never
    // overwrite an already-valid local credential with an empty wallet.
    let walletState = await loadWalletState().catch(() => ({}) as WalletState);

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const handoffToken = searchParams.get("handoff_token");
      const launchedFromPwa = searchParams.get("source") === "pwa";
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;

      if ((isStandalone || launchedFromPwa) && !walletState.credential) {
        let token = handoffToken;
        if (!token) {
          const recoveryResponse = await fetch("/api/pwa/handoff/recover", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });
          const recoveryData = (await recoveryResponse.json()) as {
            token?: string | null;
            expires_at?: string | null;
          };
          token = recoveryData.token ?? null;
        }

        if (token) {
          walletState = await claimPwaHandoff(token);
        }

        if (handoffToken || token) {
          window.history.replaceState({}, "", "/wallet?source=pwa");
        }
      }
    } catch (reason: unknown) {
      const classified = classifyError(reason);
      setError(classified.message);
      setErrorRecoveryAction(classified.recoveryAction);
    }

    setWallet(walletState);

    if (walletState.enrollmentId) {
      try {
        const response = await fetch(`/api/enrollment/${walletState.enrollmentId}`);
        if (response.ok) {
          setEnrollment((await response.json()) as EnrollmentRecord);
        }
      } catch {
        // Enrollment status is supplementary — keep the wallet/credential already loaded.
      }
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handlePwaInstalled = useCallback(() => {
    setWallet((current) =>
      current
        ? { ...current, pwaInstalledAt: current.pwaInstalledAt ?? new Date().toISOString() }
        : current
    );
  }, []);

  if (!wallet) {
    return (
      <main className="flex min-h-[calc(100vh-168px)] flex-1 items-center justify-center px-4 py-8 text-mist sm:px-6 lg:px-8">
        <section className="w-full max-w-5xl rounded-[40px] border border-white/8 bg-white/[0.03] p-10">
          <div className="h-3 w-40 animate-pulse rounded-full bg-white/8" />
          <div className="mt-5 h-16 max-w-2xl animate-pulse rounded-[20px] bg-white/8" />
        </section>
      </main>
    );
  }

  const credential = wallet.credential;
  const walletStatus = getWalletStatusSnapshot(wallet, enrollment, new Date(nowMs));
  const activationTime = credential
    ? new Date(credential.payload.activates_at).getTime()
    : enrollment
      ? new Date(enrollment.cooling_off.ends_at).getTime()
      : 0;
  const remainingSeconds = activationTime
    ? Math.max(Math.ceil((activationTime - nowMs) / 1000), 0)
    : 0;
  const active = credential
    ? new Date(credential.payload.activates_at).getTime() <= nowMs &&
      new Date(credential.payload.expires_at).getTime() > nowMs
    : false;
  const zignatureSeed = credential
    ? buildCredentialZignatureSeedInput({
        credentialId: credential.payload.credential_id,
        subjectPublicKey: credential.payload.subject_public_key
      })
    : "wallet-preview";
  return (
    <main className="flex min-h-[calc(100vh-168px)] flex-1 flex-col overflow-visible px-4 pb-52 pt-8 text-mist sm:px-6 sm:pb-44 lg:px-8 lg:pb-32">
      {error ? (
        <div className="mb-6">
          <RecoveryPanel
            message={error}
            onRetry={() => void loadWallet()}
            operation="wallet.load"
            recoveryAction={errorRecoveryAction}
            title="We could not finish loading this device's pass"
          />
        </div>
      ) : null}
      {credential ? (
        <SavedWalletState
          active={active}
          credentialId={credential.payload.credential_id}
          enrollmentId={wallet.enrollmentId}
          onPwaInstalled={handlePwaInstalled}
          pwaInstalledAt={wallet.pwaInstalledAt}
          isActionsOpen={isActionsOpen}
          onToggleActions={() => setIsActionsOpen((current) => !current)}
          zignatureSeed={zignatureSeed}
        />
      ) : (
        <EmptyWalletState />
      )}

      <WalletAffiliateFooter />
      <WalletDemoTools
        deleteButtonState={deleteButtonState}
        enrollment={enrollment}
        isPending={isPending}
        onAdvanceCoolingOff={() => {
          if (!enrollment) {
            return;
          }

          setIsPending(true);
          setError(null);
          void fetch("/api/enrollment/advance-cooling-off", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enrollmentId: enrollment.id })
          })
            .then(async (response) => {
              const data = (await response.json()) as EnrollmentRecord | ApiError;
              if (!response.ok) {
                throw new Error((data as ApiError).error ?? "Unable to advance cooling-off.");
              }

              setEnrollment(data as EnrollmentRecord);
              if ((data as EnrollmentRecord).issued_credential) {
                setWallet(
                  await storeCredential(
                    (data as EnrollmentRecord).issued_credential!,
                    (data as EnrollmentRecord).id
                  )
                );
              }
            })
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : "Unable to advance cooling-off.");
            })
            .finally(() => setIsPending(false));
        }}
        onReset={() => {
          setIsPending(true);
          void clearWallet()
            .then(async () => {
              setWallet(await loadWalletState());
              setEnrollment(null);
              setIsActionsOpen(false);
              setDeleteButtonState("deleted");
              setError(null);
            })
            .catch(() => setError("Unable to reset the local wallet."))
            .finally(() => setIsPending(false));
        }}
        showCoolingOff={Boolean(enrollment) && enrollment?.status === "approved_with_cooling_off"}
        error={error}
        onSimulateError={(scenario, message) => {
          const classified = classifyError(new Error(message), scenario);
          setError(classified.message);
          setErrorRecoveryAction(classified.recoveryAction);
        }}
      />
      <WalletStatusDock
        credential={credential}
        deleteButtonState={deleteButtonState}
        isOpen={isStatusDockOpen}
        remainingSeconds={remainingSeconds}
        status={walletStatus}
        wallet={wallet}
        onToggle={() => setIsStatusDockOpen((current) => !current)}
        onReset={() => {
          setIsPending(true);
          void clearWallet()
            .then(async () => {
              setWallet(await loadWalletState());
              setEnrollment(null);
              setIsActionsOpen(false);
              setDeleteButtonState("deleted");
              setError(null);
            })
            .catch(() => setError("Unable to reset the local wallet."))
            .finally(() => setIsPending(false));
        }}
      />
    </main>
  );
}

const DEMO_ERROR_SCENARIOS: Array<{
  scenario: ErrorCode;
  label: string;
  message: string;
}> = [
  { scenario: "network_failure", label: "Simulate network failure", message: "Failed to fetch the ZikPass wallet." },
  {
    scenario: "storage_unavailable",
    label: "Simulate storage unavailable",
    message: "This browser does not support IndexedDB, so Zik Pass cannot store a device-bound credential."
  },
  {
    scenario: "lost_response",
    label: "Simulate a lost response after issuance",
    message: "The connection dropped after your pass was issued, before the confirmation arrived."
  }
];

function WalletDemoTools({
  deleteButtonState,
  enrollment,
  error,
  isPending,
  onAdvanceCoolingOff,
  onReset,
  onSimulateError,
  showCoolingOff
}: {
  deleteButtonState: "idle" | "deleted";
  enrollment: EnrollmentRecord | null;
  error: string | null;
  isPending: boolean;
  onAdvanceCoolingOff: () => void;
  onReset: () => void;
  onSimulateError: (scenario: ErrorCode, message: string) => void;
  showCoolingOff: boolean;
}) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="relative mx-auto mt-6 w-full max-w-5xl">
      <details className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4 text-sm text-mist/70">
        <summary className="cursor-pointer font-medium text-mist">Demo tools</summary>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-mist disabled:opacity-55"
            disabled={isPending}
            onClick={onReset}
          >
            Reset local wallet
          </button>
          {showCoolingOff ? (
            <button
              className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-mist/80 disabled:opacity-55"
              disabled={isPending}
              onClick={onAdvanceCoolingOff}
            >
              Complete cooling-off
            </button>
          ) : null}
          {enrollment ? <span className="self-center text-xs text-mist/45">Enrollment {enrollment.id}</span> : null}
        </div>
        <div className="mt-4 border-t border-white/8 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-mist/40">
            Accessibility &amp; recovery test fixtures
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            {DEMO_ERROR_SCENARIOS.map((entry) => (
              <button
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-mist/80 disabled:opacity-55"
                disabled={isPending}
                key={entry.scenario}
                onClick={() => onSimulateError(entry.scenario, entry.message)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        {deleteButtonState === "deleted" ? <p className="mt-3 text-xs text-mist/45">Local wallet reset.</p> : null}
        {error ? <p className="mt-3 text-xs text-[#f8c8b4]" role="alert">{error}</p> : null}
      </details>
    </div>
  );
}

function WalletStatusDock({
  credential,
  deleteButtonState,
  isOpen,
  remainingSeconds,
  status,
  wallet,
  onReset,
  onToggle
}: {
  credential: WalletState["credential"];
  deleteButtonState: "idle" | "deleted";
  isOpen: boolean;
  remainingSeconds: number;
  status: ReturnType<typeof getWalletStatusSnapshot>;
  wallet: WalletState;
  onReset: () => void;
  onToggle: () => void;
}) {
  const statusLabel =
    status.status === "pass_issued_and_stored_locally"
      ? status.credential_active
        ? "Active"
        : "Activating"
      : status.status === "pass_expired"
        ? "Expired"
        : status.status === "pass_pending_issuance"
          ? "Pending issuance"
          : "Not started";
  const statusMeta = credential
    ? [
        { label: "Pass ID", value: credential.payload.credential_id },
        { label: "Issued via", value: formatIssuanceChannel(credential.payload.issuance_channel) },
        {
          label: "Status",
          value: status.credential_expired
            ? "Expired"
            : status.credential_active
              ? "Ready for age checks"
              : `Activates in ${remainingSeconds}s`
        },
        {
          label: "Stored",
          value: wallet.pwaInstalledAt ? "ZikPass home screen app" : "Browser wallet"
        }
      ]
    : [
        { label: "ID required", value: "Physical ID check" },
        { label: "Storage", value: wallet.holderKeyPair ? "Holder key on this device" : "Not started" },
        { label: "Wallet", value: statusLabel }
      ];

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end px-3 pb-10 transition-[height] duration-200 sm:px-6 lg:px-8 ${isOpen ? "h-44" : "h-24"}`}
    >
      <section
        aria-live="polite"
        className="pointer-events-auto mx-auto w-[85%] max-w-[1088px] rounded-[22px] border border-white/10 bg-[#0a0f18]/90 p-1.5 opacity-30 backdrop-blur-md transition-opacity duration-200 hover:opacity-100 sm:p-2"
      >
        <div className="flex flex-wrap items-center gap-2 px-1 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-mist/45">Your status</p>
            <StatusPill
              surface="dark"
              tone={statusLabel === "Active" ? "good" : statusLabel === "Expired" ? "warn" : "neutral"}
            >
              {statusLabel}
            </StatusPill>
            {credential || wallet.holderKeyPair || wallet.enrollmentId ? (
              <button
                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-mist disabled:opacity-55"
                disabled={deleteButtonState === "deleted"}
                onClick={onReset}
              >
                {deleteButtonState === "deleted" ? "Deleted" : "Delete Zik Pass from this device"}
              </button>
            ) : null}
          </div>
          <button
            aria-expanded={isOpen}
            aria-label={isOpen ? "Collapse wallet status details" : "Expand wallet status details"}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-mist hover:bg-white/10"
            onClick={onToggle}
            title={isOpen ? "Collapse status details" : "Expand status details"}
            type="button"
          >
            {isOpen ? "-" : "+"}
          </button>
        </div>
        {isOpen ? (
          <div className="mt-1 grid gap-1.5 sm:grid-cols-3 lg:min-w-[420px]">
            {statusMeta.map((item) => (
              <div key={item.label} className="rounded-[18px] bg-white/5 px-2.5 py-1.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-mist/40">{item.label}</p>
                <p className="mt-0.5 text-[11px] font-medium text-mist">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SavedWalletState({
  active,
  credentialId,
  enrollmentId,
  onPwaInstalled,
  pwaInstalledAt,
  isActionsOpen,
  onToggleActions,
  zignatureSeed
}: {
  active: boolean;
  credentialId: string;
  enrollmentId?: string;
  onPwaInstalled: () => void;
  pwaInstalledAt?: string;
  isActionsOpen: boolean;
  onToggleActions: () => void;
  zignatureSeed: string;
}) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isExtendOpen, setIsExtendOpen] = useState(false);

  function showPlaceholderMessage(label: string) {
    setActionMessage(`${label} will be available in a future wallet update.`);
    setIsExtendOpen(false);
  }

  function toggleExtendPanel() {
    setActionMessage(null);
    setIsExtendOpen((current) => !current);
  }

  return (
    <section className="relative flex flex-1 flex-col overflow-visible px-1 py-4 sm:px-2">
      <div className="relative flex items-start justify-between gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime/70">Wallet</p>
          <h1 className="mt-3 font-heading text-5xl font-semibold leading-[1.1] text-mist sm:text-7xl">
            Your Zik Pass
          </h1>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-mist">
          {active ? "Active" : "Activating"}
        </span>
      </div>

      <button
        aria-expanded={isActionsOpen}
        aria-label={isActionsOpen ? "Hide Zik Pass actions" : "Show Zik Pass actions"}
        className="relative mx-auto mt-10 block w-full max-w-2xl text-left transition-transform hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/50"
        onClick={onToggleActions}
        type="button"
      >
        <PassPreviewCard active={active} credentialId={credentialId} zignatureSeedInput={zignatureSeed} />
      </button>

      {isActionsOpen ? (
        <div className="relative mx-auto mt-6 w-full max-w-2xl rounded-[28px] border border-ink/8 bg-[#f7faee] p-5 text-ink sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/45">Pass actions</p>
              <h2 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-ink">
                Manage this pass
              </h2>
            </div>
            <button
              className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-[#edf3df]"
              onClick={onToggleActions}
              type="button"
            >
              Hide
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button
              className="rounded-[20px] border border-ink/10 bg-white px-4 py-4 text-left text-sm font-semibold text-ink transition hover:bg-[#edf3df]"
              onClick={() => showPlaceholderMessage("Delete pass")}
              type="button"
            >
              Delete pass
            </button>
            <button
              aria-expanded={isExtendOpen}
              className="rounded-[20px] border border-ink/10 bg-white px-4 py-4 text-left text-sm font-semibold text-ink transition hover:bg-[#edf3df]"
              onClick={toggleExtendPanel}
              type="button"
            >
              Extend pass
            </button>
            <button
              className="rounded-[20px] border border-ink/10 bg-white px-4 py-4 text-left text-sm font-semibold text-ink transition hover:bg-[#edf3df]"
              onClick={() => showPlaceholderMessage("Parental controls")}
              type="button"
            >
              Parental controls
            </button>
          </div>
          {actionMessage ? (
            <p className="mt-4 rounded-[18px] bg-white px-4 py-3 text-sm text-ink/68" role="status">
              {actionMessage}
            </p>
          ) : null}
          {isExtendOpen ? (
            <div className="mt-4 rounded-[22px] border border-ink/8 bg-white px-5 py-5">
              {enrollmentId ? (
                <ExtendPassPanel enrollmentId={enrollmentId} />
              ) : (
                <p role="status">This pass has no enrollment on record, so it can&rsquo;t be extended yet.</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative mt-8 flex flex-wrap items-center gap-4 text-sm text-mist/60">
        <PwaInstallButton
          className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-mist transition hover:bg-white/10"
          enrollmentId={enrollmentId}
          label="Install ZikPass on this device"
          onInstalled={onPwaInstalled}
        />
        {pwaInstalledAt ? <p>Added to this device&rsquo;s home screen.</p> : null}
      </div>
    </section>
  );
}

function EmptyWalletState() {
  return (
    <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-20 text-center sm:px-10">
      <div className="relative max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime/70">Wallet</p>
        <h1 className="mt-4 font-heading text-5xl font-semibold leading-[0.95] text-mist sm:text-7xl">
          No pass yet
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-mist/50">
          Get a signed ZikPass for this device.
        </p>
      </div>
      <Link
        className="relative mt-8 rounded-full bg-lime px-8 py-4 text-base font-semibold text-ink transition hover:bg-lime/90"
        href={buildAppOnboardingUrl() as Route}
      >
        Get ZikPass
      </Link>
    </section>
  );
}

function WalletAffiliateFooter() {
  return (
    <footer className="shrink-0 px-5 py-5">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
        {affiliateMarks.map((mark) => (
          <span
            key={mark}
            className="inline-flex h-11 min-w-28 items-center justify-center rounded-[8px] border border-white/8 bg-white/[0.03] px-4 text-sm font-semibold text-mist/70"
          >
            {mark}
          </span>
        ))}
      </div>
    </footer>
  );
}
