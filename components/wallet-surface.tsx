"use client";

import type { Route } from "next";
import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";
import {
  clearWallet,
  ensureHolderKeyPair,
  loadWalletState,
  storeCredential,
  storeEnrollmentId
} from "@/lib/client/wallet-client";
import type { EnrollmentRecord, IdentityMatchInput, WalletState } from "@/lib/shared/types";

interface ApiError {
  error: string;
}

type FlowStep =
  | "full-name"
  | "date-of-birth"
  | "current-address"
  | "moved-recently"
  | "previous-address"
  | "bank-selection"
  | "device-security"
  | "bank-verification"
  | "checking"
  | "cooling"
  | "success"
  | "rejected";

type JourneyState =
  | "idle"
  | "collecting_details"
  | "submitting"
  | "bank_verification_pending"
  | "bank_verification_confirming"
  | "bank_verification_complete"
  | "financial_check_in_progress"
  | "confidence_assessment_in_progress"
  | "cooling_off_pending"
  | "activation_ready"
  | "pass_issued"
  | "rejected";

interface Answers {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  currentHomeAddress: string;
  movedInLastThreeYears?: boolean;
  previousAddress: string;
  bankName: string;
}

interface CheckingStage {
  label: string;
  detail: string;
  journeyState: JourneyState;
}

const initialAnswers: Answers = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  currentHomeAddress: "",
  previousAddress: "",
  bankName: ""
};

const bankOptions = [
  "Barclays",
  "Lloyds Bank",
  "Monzo",
  "NatWest",
  "Santander UK",
  "HSBC UK"
];

const checkingStages: CheckingStage[] = [
  {
    label: "Finding financial record",
    detail: "Securely matching your details with adult financial signals.",
    journeyState: "financial_check_in_progress"
  },
  {
    label: "Performing financial check",
    detail: "Running a soft check that does not affect your credit score.",
    journeyState: "financial_check_in_progress"
  },
  {
    label: "Reviewing adult financial activity",
    detail: "Looking for signs of a real adult-linked financial account.",
    journeyState: "financial_check_in_progress"
  },
  {
    label: "Determining credential confidence",
    detail: "Confirming the match is strong enough to issue a pass.",
    journeyState: "confidence_assessment_in_progress"
  },
  {
    label: "Preparing secure pass",
    detail: "Binding your Zik Pass to the key created on this device.",
    journeyState: "confidence_assessment_in_progress"
  },
  {
    label: "Finalising verification",
    detail: "Creating your Over-18 pass and getting it ready to activate.",
    journeyState: "activation_ready"
  }
];

const showDevTools = process.env.NODE_ENV !== "production";

export function WalletSurface() {
  const [wallet, setWallet] = useState<WalletState>({});
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [step, setStep] = useState<FlowStep>("full-name");
  const [journeyState, setJourneyState] = useState<JourneyState>("idle");
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [possessionCode, setPossessionCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingStageIndex, setCheckingStageIndex] = useState(0);
  const [pendingCompletionEnrollment, setPendingCompletionEnrollment] =
    useState<EnrollmentRecord | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isPending, startTransition] = useTransition();

  const credential = wallet.credential;
  const activationTime = credential ? new Date(credential.payload.activates_at).getTime() : 0;
  const expiresTime = credential ? new Date(credential.payload.expires_at).getTime() : 0;
  const remainingSeconds = credential ? Math.max(Math.ceil((activationTime - nowMs) / 1000), 0) : 0;
  const active = credential ? activationTime <= nowMs : false;
  const coolingStartTime = enrollment
    ? new Date(enrollment.cooling_off.started_at).getTime()
    : credential
      ? new Date(credential.payload.issued_at).getTime()
      : 0;
  const coolingDurationMs = Math.max(activationTime - coolingStartTime, 0);
  const coolingElapsedMs = Math.max(nowMs - coolingStartTime, 0);
  const coolingProgress = coolingDurationMs
    ? Math.min((coolingElapsedMs / coolingDurationMs) * 100, 100)
    : 0;

  const applyEnrollment = useCallback((nextEnrollment: EnrollmentRecord) => {
    setEnrollment(nextEnrollment);

    if (nextEnrollment.issued_credential) {
      const nextWallet = storeCredential(nextEnrollment.issued_credential, nextEnrollment.id);
      setWallet(nextWallet);
    }
  }, []);

  const syncFromEnrollment = useCallback((nextEnrollment: EnrollmentRecord) => {
    applyEnrollment(nextEnrollment);

    if (nextEnrollment.status === "proof_rejected") {
      setJourneyState("rejected");
      setStep("rejected");
      setIsFlowOpen(true);
      return;
    }

    if (nextEnrollment.status === "bank_verification_pending") {
      setJourneyState("bank_verification_pending");
      setStep("bank-verification");
      return;
    }

    if (nextEnrollment.status === "issued_cooling_off") {
      setJourneyState("cooling_off_pending");
      setStep("cooling");
      return;
    }

    setJourneyState("pass_issued");
    setStep("success");
  }, [applyEnrollment]);

  const finalizeChecking = useCallback((nextEnrollment: EnrollmentRecord) => {
    setPendingCompletionEnrollment(null);
    applyEnrollment(nextEnrollment);

    if (nextEnrollment.status === "proof_rejected") {
      setJourneyState("rejected");
      setStep("rejected");
      return;
    }

    if (nextEnrollment.status === "issued") {
      setJourneyState("pass_issued");
      setStep("success");
      setMessage("Your Zik Pass is ready to use.");
      return;
    }

    setJourneyState("cooling_off_pending");
    setStep("cooling");
    setMessage("Your Zik Pass has been issued and is now activating.");
  }, [applyEnrollment]);

  const refreshEnrollment = useCallback(
    async (enrollmentId: string) => {
      const response = await fetch(`/api/enrollment/${enrollmentId}`);
      const data = (await response.json()) as EnrollmentRecord | ApiError;

      if (!response.ok) {
        setError((data as ApiError).error);
        return;
      }

      syncFromEnrollment(data as EnrollmentRecord);
    },
    [syncFromEnrollment]
  );

  useEffect(() => {
    setNowMs(Date.now());

    const walletState = loadWalletState();
    setWallet(walletState);

    if (walletState.enrollmentId) {
      void refreshEnrollment(walletState.enrollmentId);
    }

    if (walletState.credential) {
      const walletActivationTime = new Date(walletState.credential.payload.activates_at).getTime();
      const walletIsActive = walletActivationTime <= Date.now();
      setJourneyState(walletIsActive ? "pass_issued" : "cooling_off_pending");
      setStep(walletIsActive ? "success" : "cooling");
    }
  }, [refreshEnrollment]);

  useEffect(() => {
    if (!credential) {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [credential]);

  useEffect(() => {
    if (!enrollment?.id || step === "checking") {
      return;
    }

    if (
      enrollment.status !== "bank_verification_pending" &&
      enrollment.status !== "issued_cooling_off"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshEnrollment(enrollment.id);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [enrollment?.id, enrollment?.status, refreshEnrollment, step]);

  useEffect(() => {
    if (step !== "checking") {
      return;
    }

    if (checkingStageIndex >= checkingStages.length - 1) {
      const timer = window.setTimeout(() => {
        if (!pendingCompletionEnrollment) {
          return;
        }

        finalizeChecking(pendingCompletionEnrollment);
      }, 1200);

      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      const nextIndex = checkingStageIndex + 1;
      setCheckingStageIndex(nextIndex);
      setJourneyState(checkingStages[nextIndex].journeyState);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [checkingStageIndex, finalizeChecking, pendingCompletionEnrollment, step]);

  useEffect(() => {
    if (step !== "cooling" || !credential || !active) {
      return;
    }

    setJourneyState("activation_ready");

    const timer = window.setTimeout(() => {
      setJourneyState("pass_issued");
      setStep("success");
      setMessage("Your Zik Pass is now active on this device.");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [active, credential, step]);

  function setSuccess(nextMessage: string) {
    setMessage(nextMessage);
    setError(null);
  }

  function buildIdentityMatch(): IdentityMatchInput {
    return {
      first_name: answers.firstName.trim(),
      last_name: answers.lastName.trim(),
      date_of_birth: answers.dateOfBirth,
      current_home_address: answers.currentHomeAddress.trim(),
      previous_address:
        answers.movedInLastThreeYears && answers.previousAddress.trim()
          ? answers.previousAddress.trim()
          : undefined
    };
  }

  function openFlow() {
    setError(null);
    setMessage(null);
    setIsFlowOpen(true);

    if (!enrollment && !credential) {
      setJourneyState("collecting_details");
      setStep("full-name");
    }
  }

  function closeFlow() {
    setIsFlowOpen(false);
  }

  function resetFlow() {
    clearWallet();
    setWallet({});
    setEnrollment(null);
    setAnswers(initialAnswers);
    setPossessionCode("");
    setCheckingStageIndex(0);
    setPendingCompletionEnrollment(null);
    setJourneyState("idle");
    setStep("full-name");
    setIsFlowOpen(false);
    setMessage("Your local Zik Pass data was cleared from this browser.");
    setError(null);
  }

  function startEnrollmentSubmission() {
    setJourneyState("submitting");
    setError(null);
    setMessage(null);

    startTransition(() => {
      void (async () => {
        try {
          const nextWallet = await ensureHolderKeyPair(loadWalletState());
          setWallet(nextWallet);

          const response = await fetch("/api/enrollment/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identityMatch: buildIdentityMatch(),
              bankName: answers.bankName,
              holderPublicKey: nextWallet.holderKeyPair?.publicKeyJwk
            })
          });

          const data = (await response.json()) as EnrollmentRecord | ApiError;
          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          const nextEnrollment = data as EnrollmentRecord;
          const updatedWallet = storeEnrollmentId(nextEnrollment.id);
          setWallet(updatedWallet);
          applyEnrollment(nextEnrollment);
          setJourneyState("bank_verification_pending");
          setStep("bank-verification");
          setSuccess("Your refundable GBP 0.01 verification has been sent to the selected bank.");
        } catch (err) {
          setJourneyState("collecting_details");
          setError(err instanceof Error ? err.message : "Unable to start enrollment.");
        }
      })();
    });
  }

  function verifyBankStep() {
    if (!enrollment) {
      return;
    }

    setJourneyState("bank_verification_confirming");
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/enrollment/verify-possession", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enrollmentId: enrollment.id,
              code: possessionCode
            })
          });
          const data = (await response.json()) as EnrollmentRecord | ApiError;

          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          const nextEnrollment = data as EnrollmentRecord;
          applyEnrollment(nextEnrollment);
          setPendingCompletionEnrollment(nextEnrollment);
          setCheckingStageIndex(0);
          setJourneyState("bank_verification_complete");
          setStep("checking");
        } catch (err) {
          setJourneyState("bank_verification_pending");
          setError(err instanceof Error ? err.message : "Bank verification failed.");
        }
      })();
    });
  }

  function advanceCoolingOff() {
    if (!enrollment) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/enrollment/advance-cooling-off", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enrollmentId: enrollment.id })
          });

          const data = (await response.json()) as EnrollmentRecord | ApiError;
          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          syncFromEnrollment(data as EnrollmentRecord);
          setSuccess("Cooling-off was skipped for local testing. Your pass is active now.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to advance cooling-off.");
        }
      })();
    });
  }

  const totalQuestions = answers.movedInLastThreeYears ? 7 : 6;
  const primaryActionLabel = credential
    ? active
      ? "View Zik Pass"
      : "Check activation"
    : enrollment
      ? "Continue setup"
      : "Get Zik Pass";
  const statusHeadline = credential
    ? active
      ? "Your Zik Pass is active on this device."
      : "Your Zik Pass is activating."
    : enrollment
      ? "Your setup is in progress."
      : "Ready when you are.";
  const statusBody = credential
    ? active
      ? "You can now prove you are over 18 without sharing photo ID or personal details."
      : `Cooling-off is running. Your pass will be ready in about ${remainingSeconds} seconds.`
    : enrollment
      ? "You can close this page and come back. Your current setup will resume from the bank verification or activation step."
      : "The first-time check takes around a minute and ends with a secure Over-18 pass stored on this device.";

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,_#0b1322_0%,_#17314a_44%,_#2b6a61_100%)] px-6 py-8 text-mist shadow-panel sm:px-10 sm:py-10">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(215,241,113,0.2),_transparent_58%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <StatusPill tone="good">No photo ID required</StatusPill>
            <div className="space-y-3">
              <h2 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
                Get your Zik Pass on this device.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-mist/82 sm:text-base">
                Zik Pass helps you prove you are over 18 using a soft financial check, a
                refundable GBP 0.01 bank verification, and a secure pass stored locally on this
                device.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink"
                onClick={openFlow}
              >
                {primaryActionLabel}
              </button>
              {credential || enrollment ? (
                <button
                  className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-mist hover:bg-white/15"
                  onClick={resetFlow}
                >
                  Delete Zik Pass
                </button>
              ) : null}
              {credential ? (
                <Link
                  className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-mist hover:bg-white/15"
                  href="/verifier"
                >
                  Try example betting site
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-mist/76">
              <TrustChip label="Soft check only" />
              <TrustChip label="No biometric upload" />
              <TrustChip label="Stored securely on this device" />
            </div>
          </div>

          <div className="rounded-[30px] bg-white/10 p-5 backdrop-blur">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime">What to expect</p>
            <div className="mt-4 grid gap-3">
              <ExpectationRow
                label="1. Match your details"
                body="Answer a few familiar questions so we can find the right financial record."
              />
              <ExpectationRow
                label="2. Confirm a GBP 0.01 authorisation"
                body="Use a temporary refundable bank reference to prove you control a real account."
              />
              <ExpectationRow
                label="3. Let Zik prepare your pass"
                body="We run a soft check, bind the pass to this device, and activate it after a short delay."
              />
            </div>
          </div>
        </div>
      </section>

      {(message || error) && (
        <NoticeCard tone={error ? "warn" : "good"}>
          {message ? <p>{message}</p> : null}
          {error ? <p>{error}</p> : null}
        </NoticeCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard title="Your status" subtitle="A calmer view of where your pass stands right now.">
          <div className="space-y-4">
            <div className="rounded-[24px] bg-ink/5 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill tone={credential ? (active ? "good" : "neutral") : "neutral"}>
                  {credential ? (active ? "Active" : "Activating") : "Not started"}
                </StatusPill>
                {credential ? <StatusPill tone="good">Over-18 pass stored</StatusPill> : null}
              </div>
              <p className="mt-4 font-heading text-2xl font-semibold tracking-tight text-ink">
                {statusHeadline}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/72">{statusBody}</p>
              {credential || enrollment ? (
                <button
                  className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-mist"
                  onClick={resetFlow}
                >
                  Delete Zik Pass from this device
                </button>
              ) : null}
            </div>

            {credential ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <MetaTile label="Pass ID" value={credential.payload.credential_id} />
                <MetaTile
                  label="Status"
                  value={active ? "Ready for age checks" : `Activates in ${remainingSeconds}s`}
                />
                <MetaTile
                  label="Stored"
                  value={expiresTime ? new Date(expiresTime).toLocaleDateString() : "On this device"}
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <MetaTile label="ID required" value="No photo ID" />
                <MetaTile label="Credit impact" value="Soft check only" />
                <MetaTile label="Bank step" value="Refundable GBP 0.01" />
              </div>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard title="Why people choose Zik Pass" subtitle="Built to feel familiar, private, and easy to trust.">
          <div className="grid gap-4">
            <TrustPanel
              title="Familiar first-time check"
              body="You answer a few normal identity questions, confirm a temporary bank reference, and receive the pass on the same device."
            />
            <TrustPanel
              title="Private by design"
              body="Sites only learn that you are over 18. They do not receive your name, date of birth, or bank information."
            />
            <TrustPanel
              title="Protection before first use"
              body="A short activation delay gives you time to spot anything unexpected before the pass can be used."
            />
          </div>
        </SurfaceCard>
      </div>

      {showDevTools ? (
        <details className="rounded-[24px] bg-white/70 p-4 text-sm text-ink/72 shadow-panel">
          <summary className="cursor-pointer font-medium text-ink">Demo tools</summary>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-mist"
              onClick={resetFlow}
            >
              Reset local wallet
            </button>
            {enrollment && credential && !active ? (
              <button
                className="rounded-full bg-ink/10 px-4 py-2 text-sm font-medium text-ink"
                disabled={isPending}
                onClick={advanceCoolingOff}
              >
                Activate instantly
              </button>
            ) : null}
          </div>
        </details>
      ) : null}

      {isFlowOpen ? (
        <div className="fixed inset-0 z-50 bg-ink/55 backdrop-blur-sm" onClick={closeFlow}>
          <div className="flex h-full w-full items-stretch justify-center p-3 sm:p-6">
            <div
              className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[36px] bg-white/92 p-3 shadow-panel sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                aria-label="Close Zik Pass form"
                className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink text-xl text-mist hover:bg-ink/90"
                onClick={closeFlow}
              >
                ×
              </button>

              <div className="mb-4 pr-12">
                <JourneyTracker state={journeyState} />
              </div>

              <div className="h-full overflow-y-auto pr-0 sm:pr-2">
                {step === "full-name" ? (
                  <QuestionCard
                    step={`Question 1 of ${totalQuestions}`}
                    title="What is your full name?"
                    body="Enter the name that should match your financial record."
                    canContinue={
                      answers.firstName.trim().length > 0 && answers.lastName.trim().length > 0
                    }
                    onBack={undefined}
                    onNext={() => {
                      setJourneyState("collecting_details");
                      setStep("date-of-birth");
                    }}
                  >
                    <IdentityCheckIntro />
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <FieldInput
                        placeholder="First name"
                        value={answers.firstName}
                        onChange={(value) =>
                          setAnswers((current) => ({
                            ...current,
                            firstName: value
                          }))
                        }
                      />
                      <FieldInput
                        placeholder="Last name"
                        value={answers.lastName}
                        onChange={(value) =>
                          setAnswers((current) => ({
                            ...current,
                            lastName: value
                          }))
                        }
                      />
                    </div>
                  </QuestionCard>
                ) : null}

                {step === "date-of-birth" ? (
                  <QuestionCard
                    step={`Question 2 of ${totalQuestions}`}
                    title="What is your date of birth?"
                    body="We use this to securely match the right record for your soft financial check."
                    canContinue={isValidDate(answers.dateOfBirth)}
                    onBack={() => setStep("full-name")}
                    onNext={() => setStep("current-address")}
                  >
                    <IdentityCheckIntro compact />
                    <FieldInput
                      type="date"
                      value={answers.dateOfBirth}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          dateOfBirth: value
                        }))
                      }
                    />
                  </QuestionCard>
                ) : null}

                {step === "current-address" ? (
                  <QuestionCard
                    step={`Question 3 of ${totalQuestions}`}
                    title="What is your current home address?"
                    body="Use the address where you currently live."
                    canContinue={answers.currentHomeAddress.trim().length > 0}
                    onBack={() => setStep("date-of-birth")}
                    onNext={() => setStep("moved-recently")}
                  >
                    <IdentityCheckIntro compact />
                    <FieldTextarea
                      placeholder="Current home address"
                      value={answers.currentHomeAddress}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          currentHomeAddress: value
                        }))
                      }
                    />
                  </QuestionCard>
                ) : null}

                {step === "moved-recently" ? (
                  <QuestionCard
                    step={`Question 4 of ${totalQuestions}`}
                    title="Have you moved in the last 3 years?"
                    body="If you have, we may need one previous address to improve the record match."
                    canContinue={typeof answers.movedInLastThreeYears === "boolean"}
                    onBack={() => setStep("current-address")}
                    onNext={() =>
                      setStep(answers.movedInLastThreeYears ? "previous-address" : "bank-selection")
                    }
                  >
                    <IdentityCheckIntro compact />
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <AnswerButton
                        active={answers.movedInLastThreeYears === true}
                        label="Yes"
                        detail="I have moved in the last 3 years."
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            movedInLastThreeYears: true
                          }))
                        }
                      />
                      <AnswerButton
                        active={answers.movedInLastThreeYears === false}
                        label="No"
                        detail="My current address is enough."
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            movedInLastThreeYears: false,
                            previousAddress: ""
                          }))
                        }
                      />
                    </div>
                  </QuestionCard>
                ) : null}

                {step === "previous-address" ? (
                  <QuestionCard
                    step={`Question 5 of ${totalQuestions}`}
                    title="What was your previous address?"
                    body="Only provide this if you moved in the last 3 years."
                    canContinue={answers.previousAddress.trim().length > 0}
                    onBack={() => setStep("moved-recently")}
                    onNext={() => setStep("bank-selection")}
                  >
                    <IdentityCheckIntro compact />
                    <FieldTextarea
                      placeholder="Previous address"
                      value={answers.previousAddress}
                      onChange={(value) =>
                        setAnswers((current) => ({
                          ...current,
                          previousAddress: value
                        }))
                      }
                    />
                  </QuestionCard>
                ) : null}

                {step === "bank-selection" ? (
                  <QuestionCard
                    step={`Question ${answers.movedInLastThreeYears ? "6" : "5"} of ${totalQuestions}`}
                    title="Which bank account would you like to use for the GBP 0.01 check?"
                    body="Choose the bank that should receive the temporary refundable verification."
                    canContinue={answers.bankName.trim().length > 0}
                    onBack={() =>
                      setStep(answers.movedInLastThreeYears ? "previous-address" : "moved-recently")
                    }
                    onNext={() => setStep("device-security")}
                  >
                    <div className="rounded-[28px] bg-[linear-gradient(135deg,_rgba(215,241,113,0.18),_rgba(105,225,200,0.12))] p-5 text-sm text-ink/78">
                      <p className="font-medium text-ink">Why we ask for this</p>
                      <p className="mt-2 leading-6">
                        We send a temporary refundable GBP 0.01 verification reference so you can
                        confirm you control a real adult-linked bank account.
                      </p>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {bankOptions.map((bankName) => (
                        <BankOptionCard
                          key={bankName}
                          active={answers.bankName === bankName}
                          label={bankName}
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              bankName
                            }))
                          }
                        />
                      ))}
                    </div>
                  </QuestionCard>
                ) : null}

                {step === "device-security" ? (
                  <QuestionCard
                    step={`Question ${totalQuestions} of ${totalQuestions}`}
                    title="Secure this Zik Pass on this device?"
                    body="We create a private holder key that stays on this device. Only the public key is used to issue your pass."
                    canContinue={!isPending}
                    nextLabel={isPending ? "Starting secure check..." : "Use Face ID, fingerprint or passcode"}
                    onBack={() => setStep("bank-selection")}
                    onNext={startEnrollmentSubmission}
                  >
                    <div className="rounded-[28px] bg-ink/5 p-5 text-sm text-ink/78">
                      <p className="font-medium text-ink">What happens next</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <InlineDetail title="Local key" body="Created on this device and kept private." />
                        <InlineDetail title="Soft check" body="Looks for adult financial activity only." />
                        <InlineDetail title="No ID upload" body="No passport, selfie, or biometric upload." />
                      </div>
                    </div>
                  </QuestionCard>
                ) : null}

                {step === "bank-verification" && enrollment ? (
                  <QuestionCard
                    step="Bank verification"
                    title="Enter the 6-digit code from your banking app."
                    body="This temporary refundable authorisation confirms you control a real adult-linked bank account."
                    canContinue={possessionCode.trim().length === 6 && !isPending}
                    nextLabel={isPending ? "Confirming..." : "Confirm bank authorisation"}
                    onBack={undefined}
                    onNext={verifyBankStep}
                  >
                    <BankVerificationPanel enrollment={enrollment} />
                    <div className="mt-6">
                      <FieldInput
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={possessionCode}
                        onChange={(value) =>
                          setPossessionCode(value.replace(/\D/g, "").slice(0, 6))
                        }
                        className="tracking-[0.28em] placeholder:tracking-normal"
                      />
                    </div>
                  </QuestionCard>
                ) : null}

                {step === "checking" ? (
                  <FullscreenCard
                    eyebrow="Checking in progress"
                    title="We’re preparing your Zik Pass."
                    body="This usually takes less than a minute. Please keep this window open while we complete the checks."
                  >
                    <CheckingPanel activeIndex={checkingStageIndex} />
                  </FullscreenCard>
                ) : null}

                {step === "cooling" && credential ? (
                  <FullscreenCard
                    eyebrow="Activation in progress"
                    title="Your Zik Pass has been issued and is now protecting you."
                    body="This short wait helps you spot and stop anything unexpected before the pass can be used."
                  >
                    <div className="grid gap-4">
                      <PassPreviewCard credentialId={credential.payload.credential_id} active={false} />
                      <div className="rounded-[28px] bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-heading text-2xl font-semibold tracking-tight text-ink">
                              Activating in {remainingSeconds}s
                            </p>
                            <p className="mt-1 text-sm text-ink/68">
                              You can come back at any time. Your pass is already stored on this
                              device and will unlock automatically.
                            </p>
                          </div>
                          <StatusPill tone="neutral">Cooling-off protection</StatusPill>
                        </div>
                        <div className="mt-5 h-3 overflow-hidden rounded-full bg-ink/8">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,_#d7f171,_#69e1c8)] transition-[width] duration-1000"
                            style={{ width: `${coolingProgress}%` }}
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MetaTile label="Claim" value="Over 18 only" />
                        <MetaTile label="Privacy" value="No personal data shared" />
                        <MetaTile label="Storage" value="On this device" />
                      </div>
                    </div>
                  </FullscreenCard>
                ) : null}

                {step === "success" && credential ? (
                  <FullscreenCard
                    eyebrow="Zik Pass ready"
                    title="Your Zik Pass is ready."
                    body="You can now verify that you are over 18 without sharing photo ID, your date of birth, or your name."
                    actionLabel="Try example betting site"
                    actionHref="/verifier"
                  >
                    <div className="grid gap-4">
                      <PassPreviewCard credentialId={credential.payload.credential_id} active />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MetaTile label="Status" value="Ready for age checks" />
                        <MetaTile label="Stored" value="Securely on this device" />
                        <MetaTile label="Expires" value={new Date(expiresTime).toLocaleDateString()} />
                      </div>
                      <div className="rounded-[28px] bg-white p-5 text-sm text-ink/76">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <InlineDetail title="What sites see" body="A valid over-18 confirmation." />
                          <InlineDetail title="What stays private" body="Your identity, address, and bank details." />
                          <InlineDetail title="What you avoid" body="Photo ID uploads and biometric checks." />
                        </div>
                      </div>
                    </div>
                  </FullscreenCard>
                ) : null}

                {step === "rejected" && enrollment ? (
                  <FullscreenCard
                    eyebrow="Unable to issue"
                    title="We could not issue a Zik Pass from this check."
                    body="The eligibility check did not meet the current threshold. You can review the details and try again."
                    actionLabel="Start again"
                    onAction={() => {
                      setEnrollment(null);
                      setAnswers(initialAnswers);
                      setPossessionCode("");
                      setJourneyState("collecting_details");
                      setStep("full-name");
                      setError(null);
                    }}
                  >
                    <div className="rounded-[28px] bg-blush/35 p-5 text-sm text-ink/80">
                      <ul className="space-y-2">
                        {enrollment.proof_evaluation.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </FullscreenCard>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function JourneyTracker({ state }: { state: JourneyState }) {
  const steps = [
    {
      label: "Details",
      body: "Match your record",
      states: ["collecting_details", "submitting"] as JourneyState[]
    },
    {
      label: "Bank",
      body: "Confirm GBP 0.01",
      states: [
        "bank_verification_pending",
        "bank_verification_confirming",
        "bank_verification_complete"
      ] as JourneyState[]
    },
    {
      label: "Review",
      body: "Run secure checks",
      states: ["financial_check_in_progress", "confidence_assessment_in_progress"] as JourneyState[]
    },
    {
      label: "Activation",
      body: "Protect, then use",
      states: ["cooling_off_pending", "activation_ready", "pass_issued"] as JourneyState[]
    }
  ];

  const activeIndex = steps.findIndex((step) => step.states.includes(state));

  return (
    <div className="rounded-[26px] bg-ink/5 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {steps.map((step, index) => {
          const complete = activeIndex > index || state === "pass_issued";
          const active = activeIndex === index;

          return (
            <div
              key={step.label}
              className={`rounded-[22px] px-4 py-3 ${
                complete
                  ? "bg-ink text-mist"
                  : active
                    ? "bg-[linear-gradient(135deg,_rgba(215,241,113,0.32),_rgba(105,225,200,0.22))] text-ink"
                    : "bg-white text-ink/60"
              }`}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.22em]">{step.label}</p>
              <p className="mt-2 text-sm">{step.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionCard({
  step,
  title,
  body,
  children,
  canContinue,
  nextLabel = "Next",
  onBack,
  onNext
}: {
  step: string;
  title: string;
  body: string;
  children: ReactNode;
  canContinue: boolean;
  nextLabel?: string;
  onBack?: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex min-h-[62vh] flex-col justify-between rounded-[32px] bg-[linear-gradient(180deg,_#fffef7_0%,_#f4f6f0_100%)] p-6 sm:p-8">
      <div className="space-y-5">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/45">{step}</p>
        <div className="space-y-3">
          <h3 className="font-heading text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {title}
          </h3>
          <p className="max-w-2xl text-sm leading-7 text-ink/70 sm:text-base">{body}</p>
        </div>
        <div>{children}</div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {onBack ? (
          <button
            className="rounded-full bg-ink/8 px-5 py-3 text-sm font-medium text-ink"
            onClick={onBack}
          >
            Back
          </button>
        ) : null}
        <button
          className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist disabled:opacity-40"
          disabled={!canContinue}
          onClick={onNext}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

function FullscreenCard({
  eyebrow,
  title,
  body,
  children,
  actionLabel,
  actionHref,
  onAction
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
  actionLabel?: string;
  actionHref?: Route;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[62vh] flex-col justify-between rounded-[32px] bg-[linear-gradient(135deg,_rgba(215,241,113,0.14),_rgba(105,225,200,0.18),_rgba(255,255,255,0.94))] p-6 sm:p-8">
      <div className="space-y-5">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/45">{eyebrow}</p>
        <div className="space-y-3">
          <h3 className="font-heading text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {title}
          </h3>
          <p className="max-w-2xl text-sm leading-7 text-ink/70 sm:text-base">{body}</p>
        </div>
        {children}
      </div>

      {actionHref ? (
        <Link
          className="mt-8 inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : actionLabel ? (
        <button
          className="mt-8 inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function IdentityCheckIntro({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-[28px] bg-ink/5 p-5 text-ink/78 ${compact ? "mt-4" : ""}`}>
      <p className="font-heading text-2xl font-semibold tracking-tight text-ink">
        Help us find your financial record
      </p>
      <p className="mt-2 text-sm leading-6">
        We use this to securely check for signs of adult financial activity.
      </p>
      <div className="mt-4 space-y-2 text-sm text-ink/68">
        <p>This is a soft check and won&apos;t affect your credit score.</p>
        <p>We don&apos;t see your transactions or store your personal data after this step.</p>
      </div>
    </div>
  );
}

function BankVerificationPanel({ enrollment }: { enrollment: EnrollmentRecord }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[28px] bg-ink p-5 text-mist">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="good">{enrollment.bank_verification.bank_name}</StatusPill>
          <StatusPill tone="neutral">
            {enrollment.bank_verification.transaction_status === "confirmed" ? "Confirmed" : "Sent"}
          </StatusPill>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <BankMetaTile label="Amount" value={`GBP ${enrollment.bank_verification.amount_gbp.toFixed(2)}`} />
          <BankMetaTile label="Reference" value={enrollment.bank_verification.reference} />
          <BankMetaTile label="Refund" value="Automatic" />
        </div>
        <p className="mt-5 text-sm leading-6 text-mist/78">
          This temporary refundable authorisation helps confirm you control a real adult-linked
          account. Zik does not see your balance or transaction history.
        </p>
      </div>

      <div className="rounded-[28px] bg-white p-5 text-sm text-ink/76">
        <p className="font-medium text-ink">What to do</p>
        <div className="mt-3 space-y-3">
          <InstructionRow
            number="1"
            body="Open your banking app and look for the GBP 0.01 verification reference."
          />
          <InstructionRow
            number="2"
            body="Enter the 6-digit code shown at the end of the reference."
          />
          <InstructionRow
            number="3"
            body="We confirm the bank step, then finish preparing your pass."
          />
        </div>
      </div>
    </div>
  );
}

function CheckingPanel({ activeIndex }: { activeIndex: number }) {
  const progress = ((activeIndex + 1) / checkingStages.length) * 100;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
      <div className="rounded-[28px] bg-ink p-6 text-mist">
        <div className="flex items-center gap-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-lime" />
          </div>
          <div>
            <p className="font-heading text-2xl font-semibold tracking-tight">
              {checkingStages[activeIndex].label}
            </p>
            <p className="mt-1 text-sm text-mist/76">{checkingStages[activeIndex].detail}</p>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,_#d7f171,_#69e1c8)] transition-[width] duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-[28px] bg-white p-5">
        <div className="space-y-3">
          {checkingStages.map((stage, index) => {
            const complete = index < activeIndex;
            const current = index === activeIndex;

            return (
              <div
                key={stage.label}
                className={`rounded-[22px] border px-4 py-4 ${
                  complete
                    ? "border-transparent bg-ink text-mist"
                    : current
                      ? "border-lime/50 bg-lime/10"
                      : "border-ink/8 bg-ink/3"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      complete
                        ? "bg-lime text-ink"
                        : current
                          ? "bg-ink text-mist"
                          : "bg-ink/8 text-ink/60"
                    }`}
                  >
                    {complete ? "✓" : index + 1}
                  </span>
                  <div>
                    <p className={`font-medium ${complete ? "text-mist" : "text-ink"}`}>{stage.label}</p>
                    <p className={`mt-1 text-sm leading-6 ${complete ? "text-mist/76" : "text-ink/64"}`}>
                      {stage.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PassPreviewCard({
  credentialId,
  active
}: {
  credentialId: string;
  active: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,_#0b1322_0%,_#193148_52%,_#285a5a_100%)] p-6 text-mist">
      <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-lime/15 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime">Zik Pass</p>
            <p className="mt-2 font-heading text-3xl font-semibold tracking-tight">Over 18</p>
          </div>
          <StatusPill tone={active ? "good" : "neutral"}>{active ? "Active" : "Activating"}</StatusPill>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <BankMetaTile label="Pass ID" value={credentialId} />
          <BankMetaTile label="Identity shared" value="No" />
          <BankMetaTile label="Bound to device" value="Yes" />
        </div>
      </div>
    </div>
  );
}

function ExpectationRow({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-[22px] bg-white/8 px-4 py-4">
      <p className="text-sm font-medium text-mist">{label}</p>
      <p className="mt-1 text-sm leading-6 text-mist/76">{body}</p>
    </div>
  );
}

function TrustPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] bg-ink/5 p-5">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink/68">{body}</p>
    </div>
  );
}

function TrustChip({ label }: { label: string }) {
  return <span className="rounded-full bg-white/10 px-3 py-1">{label}</span>;
}

function AnswerButton({
  label,
  detail,
  active,
  onClick
}: {
  label: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-[28px] border px-5 py-8 text-left transition ${
        active
          ? "border-ink bg-ink text-mist"
          : "border-ink/10 bg-ink/5 text-ink hover:bg-ink/10"
      }`}
      onClick={onClick}
    >
      <span className="font-heading text-2xl font-medium tracking-tight">{label}</span>
      <p className={`mt-2 text-sm leading-6 ${active ? "text-mist/78" : "text-ink/62"}`}>{detail}</p>
    </button>
  );
}

function BankOptionCard({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-[24px] border px-4 py-5 text-left transition ${
        active
          ? "border-ink bg-ink text-mist"
          : "border-ink/10 bg-white text-ink hover:bg-ink/5"
      }`}
      onClick={onClick}
    >
      <p className="font-heading text-xl font-semibold tracking-tight">{label}</p>
      <p className={`mt-2 text-sm ${active ? "text-mist/76" : "text-ink/58"}`}>
        Use this account for the refundable verification.
      </p>
    </button>
  );
}

function FieldInput({
  type = "text",
  inputMode,
  maxLength,
  placeholder,
  value,
  className = "",
  onChange
}: {
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  placeholder?: string;
  value: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className={`w-full rounded-[24px] border border-ink/10 bg-ink/5 px-5 py-5 text-xl font-medium text-ink outline-none placeholder:text-ink/30 ${className}`}
      inputMode={inputMode}
      maxLength={maxLength}
      placeholder={placeholder}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function FieldTextarea({
  placeholder,
  value,
  onChange
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      className="min-h-40 w-full rounded-[24px] border border-ink/10 bg-ink/5 px-5 py-5 text-xl font-medium text-ink outline-none placeholder:text-ink/30"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function InlineDetail({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[20px] bg-white/75 px-4 py-4">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ink/64">{body}</p>
    </div>
  );
}

function NoticeCard({
  tone,
  children
}: {
  tone: "good" | "warn";
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[24px] px-5 py-4 text-sm shadow-panel ${
        tone === "good" ? "bg-teal/20 text-ink" : "bg-blush/40 text-ink"
      }`}
    >
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function InstructionRow({ number, body }: { number: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] bg-ink/5 px-4 py-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-mist">
        {number}
      </span>
      <p className="text-sm leading-6 text-ink/72">{body}</p>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-white px-4 py-4">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/45">{label}</p>
      <p className="mt-2 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function BankMetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white/8 px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">{label}</p>
      <p className="mt-2 text-sm font-medium text-mist">{value}</p>
    </div>
  );
}

function isValidDate(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}
