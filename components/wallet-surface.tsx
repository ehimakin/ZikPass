"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
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

type Step =
  | "landing"
  | "full-name"
  | "date-of-birth"
  | "current-address"
  | "moved-recently"
  | "previous-address"
  | "device-bind"
  | "possession"
  | "received"
  | "rejected";

interface Answers {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  currentHomeAddress: string;
  movedInLastThreeYears?: boolean;
  previousAddress: string;
}

const initialAnswers: Answers = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  currentHomeAddress: "",
  previousAddress: ""
};

export function WalletSurface() {
  const [wallet, setWallet] = useState<WalletState>({});
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [step, setStep] = useState<Step>("landing");
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [possessionCode, setPossessionCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshEnrollment = useCallback(async (enrollmentId: string) => {
    const response = await fetch(`/api/enrollment/${enrollmentId}`);
    const data = (await response.json()) as EnrollmentRecord | ApiError;

    if (!response.ok) {
      setError((data as ApiError).error);
      return;
    }

    const nextEnrollment = data as EnrollmentRecord;
    syncFromEnrollment(nextEnrollment);
  }, []);

  useEffect(() => {
    const nextWallet = loadWalletState();
    setWallet(nextWallet);

    if (nextWallet.enrollmentId) {
      setIsFlowOpen(true);
      void refreshEnrollment(nextWallet.enrollmentId);
      return;
    }

    if (nextWallet.credential) {
      setStep("received");
    }
  }, [refreshEnrollment]);

  useEffect(() => {
    if (!enrollment?.id) {
      return;
    }

    if (enrollment.status !== "awaiting_possession" && enrollment.status !== "issued_cooling_off") {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshEnrollment(enrollment.id);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [enrollment?.id, enrollment?.status, refreshEnrollment]);

  function syncFromEnrollment(nextEnrollment: EnrollmentRecord) {
    setEnrollment(nextEnrollment);

    if (nextEnrollment.issued_credential) {
      const nextWallet = storeCredential(nextEnrollment.issued_credential, nextEnrollment.id);
      setWallet(nextWallet);
    }

    if (nextEnrollment.status === "proof_rejected") {
      setStep("rejected");
      return;
    }

    if (nextEnrollment.status === "awaiting_possession") {
      setStep("possession");
      return;
    }

    if (nextEnrollment.status === "issued_cooling_off" || nextEnrollment.status === "issued") {
      setStep("received");
    }
  }

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

  function startFlow() {
    setError(null);
    setMessage(null);
    if (step === "landing") {
      setStep("full-name");
    }
    setIsFlowOpen(true);
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
    setStep("landing");
    setIsFlowOpen(false);
    setMessage("Wallet reset.");
    setError(null);
  }

  function submitEnrollment() {
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
          syncFromEnrollment(nextEnrollment);
          setSuccess("Proof captured. One confirmation code remains before the pass is issued.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to start enrollment.");
        }
      })();
    });
  }

  function verifyPossession() {
    if (!enrollment) {
      return;
    }

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
          syncFromEnrollment(nextEnrollment);
          setSuccess(
            "Zik Pass delivered. The cooling-off period is now running before vendors can unlock access."
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : "Possession verification failed.");
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
          setSuccess("Cooling-off skipped for the local demo. Your pass is active now.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to advance cooling-off.");
        }
      })();
    });
  }

  const credential = wallet.credential;
  const now = Date.now();
  const activationTime = credential ? new Date(credential.payload.activates_at).getTime() : 0;
  const expiresTime = credential ? new Date(credential.payload.expires_at).getTime() : 0;
  const remainingSeconds = credential ? Math.max(Math.ceil((activationTime - now) / 1000), 0) : 0;
  const active = credential ? activationTime <= now : false;

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[36px] border border-white/80 bg-[linear-gradient(135deg,_#0e1726_0%,_#193148_42%,_#285a5a_100%)] px-6 py-8 text-mist shadow-panel sm:px-10 sm:py-10">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(215,241,113,0.18),_transparent_52%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <StatusPill tone="good">Sprint two flow</StatusPill>
            <div className="space-y-3">
              <h2 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
                Get a Zik Pass in a few plain questions.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-mist/80 sm:text-base">
                The wallet now guides a new user through one question at a time, delivers the
                credential immediately after confirmation, and then enforces a cooling-off period
                before a betting-style vendor can unlock access.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink"
                onClick={startFlow}
              >
                Get Zik Pass
              </button>
              {credential ? (
                <Link
                  className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-mist hover:bg-white/15"
                  href="/verifier"
                >
                  Visit betting site
                </Link>
              ) : null}
              <button
                className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-mist hover:bg-white/15"
                onClick={resetFlow}
              >
                Reset wallet
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] bg-white/8 p-5 backdrop-blur">
            <FlowPill number="1" label="Answer a single question at a time" />
            <FlowPill number="2" label="Confirm the refund reference code" />
            <FlowPill number="3" label="Receive your pass and wait out cooling-off" />
            <FlowPill number="4" label="Use it at a vendor with one approval step" />
          </div>
        </div>
      </section>

      <div className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard title="Wallet state" subtitle="A compact view of what the user currently has on this device.">
            <div className="space-y-3 text-sm text-ink/75">
              <div className="flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3">
                <span>Holder keypair</span>
                <StatusPill tone={wallet.holderKeyPair ? "good" : "neutral"}>
                  {wallet.holderKeyPair ? "Ready" : "Not created"}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3">
                <span>Credential</span>
                <StatusPill tone={credential ? "good" : "neutral"}>
                  {credential ? "Stored" : "Missing"}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3">
                <span>Cooling-off</span>
                <StatusPill tone={active ? "good" : "warn"}>
                  {credential ? (active ? "Complete" : `${remainingSeconds}s left`) : "Not started"}
                </StatusPill>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="What gets signed"
            subtitle="Only the claim and non-identifying metadata are included in the credential payload."
          >
            {credential ? (
              <pre className="rounded-[24px] bg-ink p-4 text-xs text-mist">
                {JSON.stringify(credential.payload, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-ink/65">The payload appears here once a credential is issued.</p>
            )}
          </SurfaceCard>
        </div>

        {(message || error) && (
          <SurfaceCard title="Latest status">
            {message ? <p className="text-sm text-ink/75">{message}</p> : null}
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
            {expiresTime > 0 ? (
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
                Expires {new Date(expiresTime).toLocaleString()}
              </p>
            ) : null}
          </SurfaceCard>
        )}
      </div>

      {isFlowOpen ? (
        <div
          className="fixed inset-0 z-50 bg-ink/55 backdrop-blur-sm"
          onClick={closeFlow}
        >
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

              <div className="h-full overflow-y-auto pr-0 sm:pr-2">
                {step === "landing" && (
                  <FullscreenCard
                    eyebrow="Start"
                    title="Launch the Get Zik Pass flow when you’re ready."
                    body="You will answer a few familiar identity questions, create a wallet key on this device, and confirm one possession code. After that, the pass lands in your wallet and cools off before use."
                    actionLabel="Get Zik Pass"
                    onAction={startFlow}
                  >
                    <IdentityCheckIntro />
                  </FullscreenCard>
                )}

                {step === "full-name" && (
                  <QuestionCard
                    step="Question 1 of 5"
                    title="What is your full name?"
                    body="Enter the name that should match your financial record."
                    canContinue={answers.firstName.trim().length > 0 && answers.lastName.trim().length > 0}
                    onBack={() => {
                      setStep("landing");
                      closeFlow();
                    }}
                    onNext={() => setStep("date-of-birth")}
                  >
                    <IdentityCheckIntro compact />
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <input
                        className="w-full rounded-[24px] border border-ink/10 bg-ink/5 px-5 py-5 text-xl font-medium text-ink outline-none placeholder:text-ink/30"
                        placeholder="First name"
                        type="text"
                        value={answers.firstName}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            firstName: event.target.value
                          }))
                        }
                      />
                      <input
                        className="w-full rounded-[24px] border border-ink/10 bg-ink/5 px-5 py-5 text-xl font-medium text-ink outline-none placeholder:text-ink/30"
                        placeholder="Last name"
                        type="text"
                        value={answers.lastName}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            lastName: event.target.value
                          }))
                        }
                      />
                    </div>
                  </QuestionCard>
                )}

                {step === "date-of-birth" && (
                  <QuestionCard
                    step="Question 2 of 5"
                    title="What is your date of birth?"
                    body="This helps us match the right record for the soft financial check."
                    canContinue={isValidDate(answers.dateOfBirth)}
                    onBack={() => setStep("full-name")}
                    onNext={() => setStep("current-address")}
                  >
                    <IdentityCheckIntro compact />
                    <input
                      className="w-full rounded-[24px] border border-ink/10 bg-ink/5 px-5 py-5 text-3xl font-medium text-ink outline-none ring-0 placeholder:text-ink/30"
                      type="date"
                      value={answers.dateOfBirth}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          dateOfBirth: event.target.value
                        }))
                      }
                    />
                  </QuestionCard>
                )}

                {step === "current-address" && (
                  <QuestionCard
                    step="Question 3 of 5"
                    title="What is your current home address?"
                    body="Enter the address where you currently live."
                    canContinue={answers.currentHomeAddress.trim().length > 0}
                    onBack={() => setStep("date-of-birth")}
                    onNext={() => setStep("moved-recently")}
                  >
                    <IdentityCheckIntro compact />
                    <textarea
                      className="min-h-40 w-full rounded-[24px] border border-ink/10 bg-ink/5 px-5 py-5 text-xl font-medium text-ink outline-none placeholder:text-ink/30"
                      placeholder="Current home address"
                      value={answers.currentHomeAddress}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          currentHomeAddress: event.target.value
                        }))
                      }
                    />
                  </QuestionCard>
                )}

                {step === "moved-recently" && (
                  <QuestionCard
                    step="Question 4 of 5"
                    title="Have you moved home in the last 3 years?"
                    body="If you have, we may need your previous address to improve the record match."
                    canContinue={typeof answers.movedInLastThreeYears === "boolean"}
                    onBack={() => setStep("current-address")}
                    onNext={() =>
                      setStep(answers.movedInLastThreeYears ? "previous-address" : "device-bind")
                    }
                  >
                    <IdentityCheckIntro compact />
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <AnswerButton
                        active={answers.movedInLastThreeYears === true}
                        label="Yes"
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
                )}

                {step === "previous-address" && (
                  <QuestionCard
                    step="Question 5 of 5"
                    title="What was your previous address?"
                    body="Only provide this if you moved in the last 3 years."
                    canContinue={answers.previousAddress.trim().length > 0}
                    onBack={() => setStep("moved-recently")}
                    onNext={() => setStep("device-bind")}
                  >
                    <IdentityCheckIntro compact />
                    <textarea
                      className="min-h-40 w-full rounded-[24px] border border-ink/10 bg-ink/5 px-5 py-5 text-xl font-medium text-ink outline-none placeholder:text-ink/30"
                      placeholder="Previous address"
                      value={answers.previousAddress}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          previousAddress: event.target.value
                        }))
                      }
                    />
                  </QuestionCard>
                )}

                {step === "device-bind" && (
                  <QuestionCard
                    step={`Question ${answers.movedInLastThreeYears ? "6" : "5"} of ${answers.movedInLastThreeYears ? "6" : "5"}`}
                    title="Create and bind your pass to this device now?"
                    body="Zik Pass generates a local holder keypair in your browser and sends only the public key to the issuer."
                    canContinue={!isPending}
                    nextLabel="Create wallet and continue"
                    onBack={() =>
                      setStep(answers.movedInLastThreeYears ? "previous-address" : "moved-recently")
                    }
                    onNext={submitEnrollment}
                  >
                    <IdentityCheckIntro compact />
                    <div className="rounded-[28px] bg-[linear-gradient(135deg,_rgba(215,241,113,0.4),_rgba(105,225,200,0.22))] p-5 text-sm text-ink/80">
                      <p className="font-medium text-ink">What happens on the next click</p>
                      <p className="mt-2">
                        Your device generates the holder keypair, your details are used to run a soft
                        financial check, and the next screen asks for the refund-reference code if the
                        check succeeds.
                      </p>
                    </div>
                  </QuestionCard>
                )}

                {step === "possession" && enrollment && (
                  <QuestionCard
                    step="Confirmation"
                    title="What is the six-digit code shown in the refund reference?"
                    body="This simulates a live possession step before the pass is delivered."
                    canContinue={possessionCode.trim().length === 6}
                    nextLabel="Confirm code"
                    onBack={() => setStep("device-bind")}
                    onNext={verifyPossession}
                  >
                    <div className="space-y-4">
                      <div className="rounded-[28px] bg-ink p-5 text-mist">
                        <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime">
                          Mock banking app
                        </p>
                        <p className="mt-2 text-sm text-mist/75">
                          In production this would come from a real bank-linked verification step.
                        </p>
                        <p className="mt-4 font-mono text-2xl">{enrollment.possession.reference}</p>
                      </div>
                      <input
                        className="w-full rounded-[24px] border border-ink/10 bg-ink/5 px-5 py-5 text-3xl font-medium tracking-[0.25em] text-ink outline-none placeholder:tracking-normal placeholder:text-ink/30"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={possessionCode}
                        onChange={(event) =>
                          setPossessionCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                      />
                    </div>
                  </QuestionCard>
                )}

                {step === "received" && credential && (
                  <FullscreenCard
                    eyebrow={active ? "Pass active" : "Cooling-off"}
                    title={active ? "Your Zik Pass is ready to use." : "Your Zik Pass has been delivered."}
                    body={
                      active
                        ? "Cooling-off has completed. You can now use the pass at the demo betting site."
                        : `The credential is already in your wallet. It becomes usable in ${remainingSeconds} seconds.`
                    }
                    actionLabel={active ? "Go to betting site" : "Stay in wallet"}
                    actionHref={active ? "/verifier" : undefined}
                    actionTone={active ? "dark" : "light"}
                  >
                    <div className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MetaTile label="Credential ID" value={credential.payload.credential_id} />
                        <MetaTile
                          label="Activates"
                          value={new Date(credential.payload.activates_at).toLocaleTimeString()}
                        />
                        <MetaTile
                          label="Expires"
                          value={new Date(credential.payload.expires_at).toLocaleDateString()}
                        />
                      </div>

                      <div className="rounded-[28px] bg-ink/5 p-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <StatusPill tone={active ? "good" : "neutral"}>
                            {active ? "Vendor-ready" : `Cooling off: ${remainingSeconds}s`}
                          </StatusPill>
                          <StatusPill tone="good">Zignature attached</StatusPill>
                          <StatusPill tone="good">Holder-bound</StatusPill>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          {!active && enrollment ? (
                            <button
                              className="rounded-full bg-ink px-4 py-2 text-sm text-mist"
                              disabled={isPending}
                              onClick={advanceCoolingOff}
                            >
                              Advance demo state
                            </button>
                          ) : null}
                          <Link
                            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-ink"
                            href="/verifier"
                          >
                            Open betting site
                          </Link>
                        </div>
                      </div>

                      {enrollment?.notifications.length ? (
                        <div className="grid gap-3">
                          {enrollment.notifications.slice(0, 3).map((notification) => (
                            <div key={notification.id} className="rounded-[24px] bg-ink/5 p-4 text-sm text-ink/75">
                              <p>{notification.message}</p>
                              <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-ink/45">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </FullscreenCard>
                )}

                {step === "rejected" && enrollment && (
                  <FullscreenCard
                    eyebrow="Not approved"
                    title="This proof does not meet the issuance threshold."
                    body="Sprint two still applies the issuer rule before a pass can be issued. Adjust the answers and try again."
                    actionLabel="Start again"
                    onAction={() => {
                      setEnrollment(null);
                      setAnswers(initialAnswers);
                      setStep("full-name");
                      setError(null);
                    }}
                    actionTone="dark"
                  >
                    <div className="rounded-[28px] bg-blush/35 p-5 text-sm text-ink/80">
                      <ul className="space-y-2">
                        {enrollment.proof_evaluation.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </FullscreenCard>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlowPill({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-white/8 px-4 py-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-lime text-xs font-semibold text-ink">
        {number}
      </span>
      <span className="text-sm text-mist/80">{label}</span>
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
    <div className="flex min-h-[66vh] flex-col justify-between rounded-[32px] bg-[linear-gradient(180deg,_#fffef7_0%,_#f4f6f0_100%)] p-6 sm:p-8">
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
  actionTone = "dark",
  actionHref,
  onAction
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
  actionLabel: string;
  actionTone?: "dark" | "light";
  actionHref?: Route;
  onAction?: () => void;
}) {
  const actionClass =
    actionTone === "dark"
      ? "bg-ink text-mist"
      : "bg-lime text-ink";

  return (
    <div className="flex min-h-[66vh] flex-col justify-between rounded-[32px] bg-[linear-gradient(135deg,_rgba(215,241,113,0.14),_rgba(105,225,200,0.18),_rgba(255,255,255,0.92))] p-6 sm:p-8">
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
        <Link className={`mt-8 inline-flex w-fit rounded-full px-5 py-3 text-sm font-semibold ${actionClass}`} href={actionHref}>
          {actionLabel}
        </Link>
      ) : (
        <button
          className={`mt-8 inline-flex w-fit rounded-full px-5 py-3 text-sm font-semibold ${actionClass}`}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function AnswerButton({
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
      className={`rounded-[28px] border px-5 py-10 text-left transition ${
        active
          ? "border-ink bg-ink text-mist"
          : "border-ink/10 bg-ink/5 text-ink hover:bg-ink/10"
      }`}
      onClick={onClick}
    >
      <span className="font-heading text-2xl font-medium tracking-tight">{label}</span>
    </button>
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

function isValidDate(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}
