"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import {
  claimPwaHandoff,
  clearWallet,
  loadWalletState,
  storeCredential
} from "@/lib/client/wallet-client";
import { isDemoEnvironment } from "@/lib/shared/demo-environment";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";
import type { EnrollmentRecord, WalletState } from "@/lib/shared/types";
import { VerificationSeal } from "@/components/customer/verification-seal";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { Alert, Button, ButtonLink, Card, SectionHeading, Skeleton, StatusBadge } from "@/components/customer/ui";
import { ShieldIcon, ClockIcon } from "@/components/customer/icons";

/** Display-only synthetic credential for design review / demo rehearsal.
 *  Never stored; only rendered when ?demo=active|activating|expired in a
 *  demo environment. */
function demoWallet(mode: string): WalletState {
  const now = Date.now();
  const activates =
    mode === "activating" ? now + 8000 : now - 1000 * 60 * 60 * 24 * 30;
  const expires =
    mode === "expired" ? now - 1000 * 60 * 60 * 24 : now + 1000 * 60 * 60 * 24 * 300;
  return {
    credential: {
      algorithm: "Ed25519",
      zignature: "demo-zignature-preview-signature-value",
      payload: {
        credential_id: "zik_demo_9f2c14a7b8",
        issued_at: new Date(now - 1000 * 60 * 60 * 24 * 65).toISOString(),
        activates_at: new Date(activates).toISOString(),
        expires_at: new Date(expires).toISOString(),
        subject_public_key: { kty: "OKP", crv: "Ed25519", x: "demo-preview-subject-key" }
      }
    }
  } as unknown as WalletState;
}

export function PassScreen() {
  const params = useSearchParams();
  const demoMode = isDemoEnvironment ? params.get("demo") : null;
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (demoMode) {
      setWallet(demoWallet(demoMode));
      return;
    }
    loadWalletState()
      .then(async (state) => {
        // PWA install / device handoff: claim a pending credential onto this
        // device the first time the installed app opens.
        try {
          const search = new URLSearchParams(window.location.search);
          const handoffToken = search.get("handoff_token");
          const launchedFromPwa = search.get("source") === "pwa";
          const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone === true;
          if ((isStandalone || launchedFromPwa || handoffToken) && !state.credential) {
            let token = handoffToken;
            if (!token) {
              const recovery = await fetch("/api/pwa/handoff/recover", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
              })
                .then((r) => r.json() as Promise<{ token?: string | null }>)
                .catch(() => ({ token: null }));
              token = recovery.token ?? null;
            }
            if (token) {
              state = await claimPwaHandoff(token);
              setWallet(state);
            }
            if (handoffToken) {
              window.history.replaceState({}, "", "/pass?source=pwa");
            }
          }
        } catch {
          /* handoff is best-effort; fall through to whatever is stored locally */
        }

        if (state.enrollmentId) {
          const res = await fetch(`/api/enrollment/${state.enrollmentId}`).catch(() => null);
          if (res?.ok) {
            const record = (await res.json()) as EnrollmentRecord;
            setEnrollment(record);
            // Reconcile a lost issuance callback: the pass was issued server-side
            // but never landed in local storage (e.g. the tab closed mid-flow).
            if (!state.credential && record.status === "issued" && record.issued_credential) {
              const next = await storeCredential(record.issued_credential, record.id).catch(() => state);
              setWallet(next);
              return;
            }
          }
        }
        setWallet(state);
      })
      .catch(() => setWallet({}));
  }, [demoMode]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!wallet) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-52 w-full rounded-[var(--zk-r-xl)]" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const credential = wallet.credential;
  const snapshot = getWalletStatusSnapshot(wallet, enrollment, new Date(now));

  if (!credential) {
    return <EmptyPass pending={snapshot.status === "pass_pending_issuance"} />;
  }

  const activatesAt = new Date(credential.payload.activates_at).getTime();
  const expiresAt = new Date(credential.payload.expires_at).getTime();
  const active = activatesAt <= now && expiresAt > now;
  const expired = expiresAt <= now;
  const secondsToActive = Math.max(0, Math.ceil((activatesAt - now) / 1000));


  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]">My pass</h1>
        <StatusBadge tone={expired ? "critical" : active ? "positive" : "caution"} dot>
          {expired ? "Expired" : active ? "Active" : "Activating"}
        </StatusBadge>
      </div>

      <VerificationSeal credential={credential} detailed />

      {active ? <ButtonLink href={"/id" as Route} size="lg">Present Zik ID in person</ButtonLink> : null}

      {!active && !expired ? (
        <Alert tone="info" title="Almost ready">
          Your pass activates in {secondsToActive}s. This short hold is a cooling-off
          period. You can close the app - it stays saved on this device.
        </Alert>
      ) : null}

      {expired ? (
        <Alert
          tone="critical"
          title="This pass has expired"
          action={
            <ButtonLink href={"/find" as Route} size="md">
              Renew at a store
            </ButtonLink>
          }
        >
          Passes last 12 months. Visit any Zik store with photo ID to get a new one.
        </Alert>
      ) : null}

      <section>
        <SectionHeading>Use your pass</SectionHeading>
        <Card className="divide-y divide-[var(--zk-line)]">
          <Row
            icon={<ShieldIcon className="h-5 w-5 text-[var(--zk-text-soft)]" />}
            title="On a participating site"
            body="When a site asks you to verify age, choose Zik Pass and approve the check."
          />
          <Row
            icon={<ClockIcon className="h-5 w-5 text-[var(--zk-text-soft)]" />}
            title="Extend to more devices"
            body="Your pass covers 2 devices. Ask staff at any Zik store to add another."
          />
        </Card>
      </section>

      <section>
        <SectionHeading>Add to another device</SectionHeading>
        <Card className="p-4">
          <p className="text-[13px] leading-relaxed text-[var(--zk-text-soft)]">
            Install Zik Pass on this phone&rsquo;s home screen, then use the one-time
            transfer link to move this pass to it.
          </p>
          <PwaInstallButton
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--zk-line-strong)] bg-[var(--zk-card)] px-5 text-[15px] font-semibold text-[var(--zk-text)] hover:bg-[var(--zk-sunken)]"
            label="Install on this device"
            enrollmentId={wallet.enrollmentId}
          />
        </Card>
      </section>

      <DeletePassRow
        onDeleted={async () => {
          await clearWallet().catch(() => undefined);
          setWallet({});
        }}
      />
    </div>
  );
}

function DeletePassRow({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <details className="rounded-[var(--zk-r-md)] border border-[var(--zk-line)] bg-[var(--zk-card)] px-4 py-3 text-[13px] text-[var(--zk-text-soft)]">
      <summary className="cursor-pointer font-semibold text-[var(--zk-text)]">
        Remove this pass from this device
      </summary>
      <p className="mt-2">
        Deleting removes the pass and its device key here. You can move it back from
        another device you added, or get a new pass at a store.
      </p>
      {!confirming ? (
        <Button variant="secondary" className="mt-3" size="md" onClick={() => setConfirming(true)}>
          Delete pass from this device
        </Button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="font-semibold text-[var(--zk-critical)]">
            Delete the pass from this device? This can&rsquo;t be undone here.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="md"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await onDeleted();
              }}
            >
              Yes, delete
            </Button>
            <Button variant="ghost" size="md" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      )}
    </details>
  );
}

function Row({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-[14px] font-bold text-[var(--zk-text)]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-[var(--zk-text-soft)]">{body}</p>
      </div>
    </div>
  );
}

function EmptyPass({ pending }: { pending: boolean }) {
  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]">My pass</h1>

      <Card className="flex flex-col items-center px-6 py-10 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--zk-sunken)]">
          <ShieldIcon className="h-7 w-7 text-[var(--zk-text-faint)]" />
        </span>
        <p className="mt-4 text-[17px] font-bold text-[var(--zk-text)]">
          {pending ? "Your pass is being issued" : "No pass on this device yet"}
        </p>
        <p className="mt-1.5 max-w-[36ch] text-[14px] leading-relaxed text-[var(--zk-text-soft)]">
          {pending
            ? "Finish the steps from where you left off. Your progress is saved."
            : "Get verified once at a Zik store, then reuse your pass online for a year."}
        </p>
        <ButtonLink href={pending ? ("/get-pass" as Route) : ("/find" as Route)} size="lg" className="mt-5">
          {pending ? "Resume" : "Find a store"}
        </ButtonLink>
        {!pending ? (
          <ButtonLink href={"/card" as Route} variant="ghost" size="lg" className="mt-2">
            I bought a Zik Pass card
          </ButtonLink>
        ) : null}
      </Card>

      {!pending ? (
        <p className="px-1 text-[13px] leading-relaxed text-[var(--zk-text-soft)]">
          Already have Zik Pass on another device? Open its{" "}
          <span className="font-semibold text-[var(--zk-text)]">My pass</span> screen and use
          the transfer link to move it here.
        </p>
      ) : null}
    </div>
  );
}
