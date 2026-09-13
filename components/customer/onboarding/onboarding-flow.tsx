"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Route } from "next";
import QRCode from "qrcode";
import {
  ensureHolderKeyPair,
  loadWalletState,
  storeCredential,
  storeEnrollmentContext
} from "@/lib/client/wallet-client";
import type { EnrollmentRecord, WalletState } from "@/lib/shared/types";
import { getStoreById, type ZikStore } from "@/lib/shared/stores";
import { buildRetailVerificationScanUrl } from "@/lib/shared/physical-flow";
import type { PassPrice } from "@/lib/shared/payment-config";
import { Alert, Button, ButtonLink, Card } from "@/components/customer/ui";
import { CheckIcon, ClockIcon } from "@/components/customer/icons";
import { PaymentPanel } from "@/components/customer/onboarding/payment-panel";

const POLL_MS = 3000;

type Phase =
  | "intro"
  | "starting"
  | "at_store"
  | "device_check"
  | "finishing"
  | "done"
  | "rejected"
  | "expired"
  | "error";

interface Props {
  /** A pre-created enrolment (e.g. claimed from a clerk purchase-sale QR). */
  initialEnrollment?: EnrollmentRecord;
  price: PassPrice;
  storeId?: string;
}

export function OnboardingFlow({ price, storeId: storeIdProp, initialEnrollment }: Props) {
  const params = useSearchParams();
  const storeId =
    storeIdProp ||
    params.get("store_id") ||
    readStoredStore() ||
    undefined;
  const store = getStoreById(storeId);

  const [phase, setPhase] = useState<Phase>(initialEnrollment ? "at_store" : "intro");
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(initialEnrollment ?? null);
  const [error, setError] = useState<string | null>(null);
  const [deviceAuthDone, setDeviceAuthDone] = useState(false);
  const [paidFlag, setPaidFlag] = useState(false);
  const startedRef = useRef(false);
  const deviceAuthRef = useRef(false);

  const enrollmentId = enrollment?.id;
  const pv = enrollment?.physical_verification;
  const clerkLookedUp = Boolean(pv?.clerk_lookup_at);
  const clerkVerified = pv?.clerk_verification.status === "verified";
  // A purchase-sale enrolment (reached via `initialEnrollment` from a clerk QR)
  // is already paid at the till, so the customer sees no payment step.
  const needsPayment = !price.free && !initialEnrollment;
  const paid =
    paidFlag ||
    enrollment?.status === "issued" ||
    enrollment?.status === "credential_pending_issuance" ||
    !needsPayment;

  /* ---- start the flow ---- */
  const start = useCallback(async () => {
    if (startedRef.current || !storeId) return;
    startedRef.current = true;
    setPhase("starting");
    setError(null);
    try {
      // Resume an in-flight enrollment on this device if there is one.
      const existing = await loadWalletState().catch(() => ({}) as WalletState);
      if (existing.enrollmentId && existing.enrollmentLane === "physical") {
        const res = await fetch(`/api/enrollment/${existing.enrollmentId}`);
        if (res.ok) {
          const record = (await res.json()) as EnrollmentRecord;
          if (record.status !== "issued" && !isTerminal(record)) {
            setEnrollment(record);
            setPhase("at_store");
            return;
          }
        }
      }

      const wallet = await ensureHolderKeyPair();
      const sessionRes = await fetch("/api/physical/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId })
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(session.error ?? "Could not reserve a store session.");

      const startRes = await fetch("/api/enrollment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holderPublicKey: wallet.holderKeyPair?.publicKeyJwk,
          lane: "physical",
          physicalContext: {
            session_id: session.session_id,
            store_id: session.store_id,
            store_name: session.store_name,
            location_id: session.location_id,
            entry_mode: session.entry_mode
          }
        })
      });
      const record = (await startRes.json()) as EnrollmentRecord & { error?: string };
      if (!startRes.ok) throw new Error(record.error ?? "Could not start verification.");

      await storeEnrollmentContext({
        enrollmentId: record.id,
        enrollmentLane: "physical",
        physicalSessionId: session.session_id
      });
      setEnrollment(record);
      setPhase("at_store");
    } catch (reason) {
      startedRef.current = false;
      setError(reason instanceof Error ? reason.message : "Something went wrong starting verification.");
      setPhase("error");
    }
  }, [storeId]);

  /* ---- poll enrollment ---- */
  useEffect(() => {
    if (!enrollmentId || phase === "done" || phase === "rejected" || phase === "expired") return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/enrollment/${enrollmentId}`);
        if (!res.ok || !active) return;
        const record = (await res.json()) as EnrollmentRecord;
        if (!active) return;
        setEnrollment(record);
      } catch {
        /* transient - keep polling */
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [enrollmentId, phase]);

  /* ---- react to enrollment status ---- */
  useEffect(() => {
    if (!enrollment) return;
    const s = enrollment.status;

    if (s === "issued" && enrollment.issued_credential) {
      void storeCredential(enrollment.issued_credential, enrollment.id).then(() => setPhase("done"));
      return;
    }
    if (s === "declined_physical_verification" || pv?.status === "rejected") {
      setPhase("rejected");
      return;
    }
    if (s === "verification_session_expired" || pv?.status === "expired") {
      setPhase("expired");
      return;
    }
    if (s === "device_auth_pending" && !deviceAuthRef.current) {
      deviceAuthRef.current = true;
      void runDeviceAuth(enrollment.id);
      return;
    }
    if ((s === "approved_with_cooling_off" || s === "credential_pending_issuance") && !needsPayment) {
      // No payment needed (free or retail-card) - push issuance.
      void fetch("/api/enrollment/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: enrollment.id })
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollment?.status, pv?.status, needsPayment]);

  async function runDeviceAuth(id: string) {
    setPhase("device_check");
    try {
      const startRes = await fetch("/api/physical/device-auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId: id })
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error ?? "Device check could not start.");

      const doneRes = await fetch("/api/physical/device-auth/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: id,
          challengeId: startData.challenge_id,
          method: "demo_device_check"
        })
      });
      const doneData = (await doneRes.json()) as EnrollmentRecord & { error?: string };
      if (!doneRes.ok) throw new Error(doneData.error ?? "Device check failed.");
      setDeviceAuthDone(true);
      setEnrollment(doneData);
      setPhase(doneData.status === "issued" ? "finishing" : "at_store");
    } catch (reason) {
      deviceAuthRef.current = false;
      setError(reason instanceof Error ? reason.message : "Device check failed.");
      setPhase("error");
    }
  }

  /* ---- render ---- */

  if (!store) {
    return (
      <Card className="p-5">
        <p className="text-[15px] font-bold text-[var(--zk-text)]">Choose a store first</p>
        <p className="mt-1.5 text-[14px] text-[var(--zk-text-soft)]">
          Pick where you&rsquo;ll get verified in person, then come back here.
        </p>
        <ButtonLink href={"/find" as Route} className="mt-4">
          Choose a store
        </ButtonLink>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4">
        <SuccessMark />
        <div className="text-center">
          <h1 className="text-[22px] font-extrabold text-[var(--zk-text)]">Your pass is ready</h1>
          <p className="mx-auto mt-1.5 max-w-[34ch] text-[14px] text-[var(--zk-text-soft)]">
            It&rsquo;s saved on this device. Open it any time from the My pass tab.
          </p>
        </div>
        <ButtonLink href={"/pass" as Route} size="lg">
          Open my pass
        </ButtonLink>
      </div>
    );
  }

  if (phase === "rejected") {
    return (
      <Alert tone="critical" title="The ID check didn't pass">
        Store staff couldn&rsquo;t confirm you&rsquo;re over 18 from the ID shown. Nothing was
        charged. If you think this is wrong, speak to staff in the store.
        <div className="mt-3">
          <ButtonLink href={"/home" as Route} variant="secondary">
            Back to home
          </ButtonLink>
        </div>
      </Alert>
    );
  }

  if (phase === "expired") {
    return (
      <Alert
        tone="caution"
        title="This session timed out"
        action={
          <Button
            onClick={() => {
              startedRef.current = false;
              deviceAuthRef.current = false;
              setEnrollment(null);
              setPhase("intro");
            }}
          >
            Start again
          </Button>
        }
      >
        Your verification code expired before it was used. Starting again takes a moment.
      </Alert>
    );
  }

  if (phase === "error") {
    return (
      <Alert
        tone="critical"
        title="Something went wrong"
        action={
          <Button
            onClick={() => {
              setError(null);
              if (enrollment) setPhase("at_store");
              else {
                startedRef.current = false;
                setPhase("intro");
              }
            }}
          >
            Try again
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  if (phase === "intro") {
    return <Intro store={store} price={price.display} onStart={start} />;
  }

  // starting / at_store / device_check / finishing
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]">
          Get verified at {store.name}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--zk-text-soft)]">
          {store.addressLine}, {store.postcode}
        </p>
      </header>

      {pv?.user_code?.value && !clerkVerified ? (
        <CodeCard code={pv.user_code.value} sessionId={pv.session.session_id} />
      ) : null}

      <Checklist
        clerkLookedUp={clerkLookedUp}
        clerkVerified={clerkVerified}
        needsPayment={needsPayment}
        paid={paid}
        deviceChecked={
          deviceAuthDone ||
          pv?.device_auth.status === "verified" ||
          enrollment?.status === "issued"
        }
        phase={phase}
      />

      {needsPayment && enrollmentId && (clerkLookedUp || clerkVerified) && enrollment?.status !== "issued" ? (
        <PaymentPanel
          enrollmentId={enrollmentId}
          storeId={store.id}
          price={price}
          clerkLookedUp={clerkLookedUp}
          onPaid={() => setPaidFlag(true)}
        />
      ) : null}

      {phase === "device_check" ? (
        <Alert tone="info" title="Checking this device">
          Binding your pass to this device. This only takes a second.
        </Alert>
      ) : null}

      {phase === "finishing" ? (
        <Alert tone="info" title="Finishing up">
          Issuing your signed pass&hellip;
        </Alert>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Intro({
  store,
  price,
  onStart
}: {
  store: ZikStore;
  price: string;
  onStart: () => void;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]">
          Get your Zik Pass
        </h1>
        <p className="mt-1 text-[14px] text-[var(--zk-text-soft)]">
          At {store.name} &middot; {store.addressLine}, {store.postcode}
        </p>
      </header>

      <Card className="p-4">
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--zk-text-faint)]">
          Bring with you
        </p>
        <ul className="mt-2 space-y-2 text-[14px] text-[var(--zk-text)]">
          {["Photo ID (passport, driving licence or PASS card)", "This phone"].map((item) => (
            <li key={item} className="flex gap-2.5">
              <CheckIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--zk-positive)]" />
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--zk-text-faint)]">
          What happens
        </p>
        <ol className="mt-2 space-y-2.5 text-[14px] text-[var(--zk-text)]">
          <li><span className="font-semibold">1.</span> We show you a 6-character code.</li>
          <li><span className="font-semibold">2.</span> A clerk checks your ID and enters the code.</li>
          <li>
            <span className="font-semibold">3.</span>{" "}
            {`You pay ${price === "Free" ? "nothing" : price} and your pass is issued to this phone.`}
          </li>
        </ol>
        <p className="mt-3 text-[12px] text-[var(--zk-text-faint)]">
          Your ID is checked visually and handed back. It is not scanned, photographed or stored.
        </p>
      </Card>

      <Button size="lg" onClick={onStart}>
        {price === "Free" ? "Start" : `Start - ${price}`}
      </Button>
    </div>
  );
}

function CodeCard({ code, sessionId }: { code: string; sessionId: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    const url =
      typeof window !== "undefined"
        ? new URL(buildRetailVerificationScanUrl({ userCode: code, sessionId }), window.location.origin).toString()
        : buildRetailVerificationScanUrl({ userCode: code, sessionId });
    void QRCode.toDataURL(url, {
      color: { dark: "#0E1726", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 420
    }).then(setQr).catch(() => setQr(null));
  }, [code, sessionId]);

  return (
    <div className="overflow-hidden rounded-[var(--zk-r-xl)] bg-[var(--zk-ink-surface)] p-5 text-center text-[var(--zk-text-on-ink)]">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--zk-accent)]">
        Show this to the clerk
      </p>
      <p className="mt-3 font-mono text-[40px] font-bold leading-none tracking-[0.14em]">{code}</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt={`QR code for verification code ${code}`}
          className="mx-auto mt-4 h-40 w-40 rounded-[var(--zk-r-md)] bg-white p-2"
        />
      ) : (
        <div className="mx-auto mt-4 h-40 w-40 rounded-[var(--zk-r-md)] bg-white/10" />
      )}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-white/55">
        <ClockIcon className="h-3.5 w-3.5" />
        Codes expire after a few minutes - keep this screen open
      </p>
    </div>
  );
}

function Checklist({
  clerkLookedUp,
  clerkVerified,
  needsPayment,
  paid,
  deviceChecked,
  phase
}: {
  clerkLookedUp: boolean;
  clerkVerified: boolean;
  needsPayment: boolean;
  paid: boolean;
  deviceChecked: boolean;
  phase: Phase;
}) {
  const steps: Array<{ label: string; detail?: string; done: boolean; active: boolean }> = [
    {
      label: clerkLookedUp ? "Clerk found your code." : "Waiting for the clerk",
      detail: clerkLookedUp && !clerkVerified ? "Now show them your ID." : undefined,
      done: clerkLookedUp,
      active: !clerkLookedUp
    },
    { label: "ID check confirmed", done: clerkVerified, active: clerkLookedUp && !clerkVerified }
  ];
  if (needsPayment) {
    steps.push({ label: "Payment", done: paid, active: clerkLookedUp && !paid });
  }
  steps.push({
    label: "Device check",
    done: deviceChecked,
    active: phase === "device_check"
  });
  steps.push({
    label: "Pass issued",
    done: phase === "done",
    active: phase === "finishing"
  });

  return (
    <Card className="divide-y divide-[var(--zk-line)]">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-3 p-3.5">
          <span
            className={
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] " +
              (step.done
                ? "border-[var(--zk-positive)] bg-[var(--zk-positive)] text-white"
                : step.active
                  ? "border-[var(--zk-text)] text-[var(--zk-text)]"
                  : "border-[var(--zk-line-strong)] text-[var(--zk-text-faint)]")
            }
          >
            {step.done ? <CheckIcon className="h-3.5 w-3.5" /> : null}
          </span>
          <span
            className={
              "text-[14px] " +
              (step.done || step.active
                ? "font-semibold text-[var(--zk-text)]"
                : "text-[var(--zk-text-faint)]")
            }
          >
            <span className="block">{step.label}</span>
            {step.detail ? (
              <span className="mt-0.5 block text-[var(--zk-positive)]">{step.detail}</span>
            ) : null}
          </span>
          {step.active ? (
            <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-[var(--zk-text)]" />
          ) : null}
        </div>
      ))}
    </Card>
  );
}

function SuccessMark() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--zk-positive-bg)]">
      <CheckIcon className="h-8 w-8 text-[var(--zk-positive)]" />
    </div>
  );
}

function isTerminal(record: EnrollmentRecord): boolean {
  return [
    "declined_physical_verification",
    "declined_identity_mismatch",
    "declined_no_adult_signal",
    "declined_bank_control_failed",
    "declined_duplicate_application",
    "verification_session_expired"
  ].includes(record.status);
}

function readStoredStore(): string | null {
  try {
    return window.localStorage.getItem("zikpass-selected-store");
  } catch {
    return null;
  }
}
