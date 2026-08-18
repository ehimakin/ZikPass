"use client";

import type { Route } from "next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Zignature } from "@/components/zignature";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";
import { ZikLogoMark } from "@/components/zik-logo";
import {
  clearWallet,
  ensureHolderKeyPair,
  loadWalletState,
  storeCredential,
  storeEnrollmentContext
} from "@/lib/client/wallet-client";
import {
  buildRetailVerificationScanUrl,
  buildZikAppDeepLink,
  getOnboardingEntryMode,
  formatAssuranceLevel,
  formatIssuanceChannel,
  getCredentialExperienceVariant,
  getPhysicalProcessState,
  parseWalletEntryContext
} from "@/lib/shared/physical-flow";
import { base64UrlToBytes, stableStringify } from "@/lib/shared/utils";
import { buildCredentialZignatureSeedInput } from "@/lib/shared/zignature";
import type {
  EnrollmentRecord,
  PhysicalStoreSessionRecord,
  WalletState
} from "@/lib/shared/types";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";

interface ApiError {
  error: string;
}

interface PhysicalDeviceAuthStartResponse {
  enrollment: EnrollmentRecord;
  challenge_id: string;
  challenge: string;
  expires_at: string;
}

type FlowStep =
  | "full-name"
  | "date-of-birth"
  | "current-address"
  | "moved-recently"
  | "previous-address"
  | "bank-selection"
  | "device-security"
  | "physical-session"
  | "physical-verification"
  | "device-auth"
  | "bank-verification"
  | "cooling"
  | "success"
  | "rejected";

type JourneyState =
  | "idle"
  | "collecting_details"
  | "submitting"
  | "physical_session_detected"
  | "awaiting_clerk_verification"
  | "device_auth_required"
  | "physical_verification_complete"
  | "bank_verification_pending"
  | "bank_verification_confirming"
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

const heroSlides = [
  {
    pill: "No photo ID required",
    title: "Prove with your name, not your face.",
    body:
      "ZikPass layers a soft financial check with bank authorisation, device-bound keys, and issuer signing to prove over 18. Only the minimum pending review data is kept server-side."
  },
  {
    pill: "Onboarding",
    title: "Complete the form to start the process",
    body:
      "You will be guided through the onboarding process. Bank verification will require your input to complete the onboarding."
  },
  {
    pill: "Cooling off",
    title: "Cooling off",
    body:
      "Once you complete onboarding, this device keeps your private holder key locally while your application waits through cooling-off. After that, Zik signs the credential and sends it back to this device."
  }
] as const;

const howZikPassWorksSlides = [
  {
    label: "Signals",
    title: "ZikPass starts with adult-linked financial signals",
    body:
      "The process begins with a soft financial check and a refundable bank authorisation, so the proof is based on trusted signals instead of photo ID or biometrics.",
    art: "signals"
  },
  {
    label: "Signing",
    title: "A signed credential is created for this device",
    body:
      "After onboarding and cooling off, the pass is reviewed, signed, and bound to the holder key created on this device so it can be used without revealing identity.",
    art: "signing"
  },
  {
    label: "Verification",
    title: "Sites verify over-18 status, not your identity",
    body:
      "When you present ZikPass, a site checks the signed credential and learns only that you are over 18. Your name, address, and bank details stay out of the exchange.",
    art: "verification"
  }
] as const;

const physicalHowZikPassWorksSlides = [
  {
    label: "Store",
    title: "Scan a normal retail-card QR",
    body:
      "The printed QR is generic. It starts a fresh Zik session on your phone without collecting identity details.",
    art: "physical-session"
  },
  {
    label: "Staff",
    title: "Show your physical ID once, in person",
    body:
      "A staff member checks your ID at the till and sends Zik only the authorised 18+ result.",
    art: "staff-check"
  },
  {
    label: "Pass",
    title: "Receive an in-person verified ZikPass",
    body:
      "Zik signs the 18+ credential for the holder public key on this device. Your ID is not uploaded or stored by Zik.",
    art: "physical-pass"
  }
] as const;

const parentalControlsSlide = {
  title: "Zik Parental Controls",
  body:
    "A future set of wallet controls for reviewing pass transfers, managing trusted devices, and adding extra safeguards around pass use."
} as const;

const physicalHeroBulletPoints = [
  "Check your preferred ID is accepted",
  "Select your nearest store to reserve your pass",
  "Visit the store in person to redeem your pass"
] as const;

interface AffiliateStore {
  id: string;
  name: string;
  area: string;
  address: string;
  mapPosition: {
    left: string;
    top: string;
  };
}

const affiliateStores: AffiliateStore[] = [
  {
    id: "zik-london-001",
    name: "Zik Oxford Street",
    area: "Central London",
    address: "Oxford Street",
    mapPosition: { left: "28%", top: "34%" }
  },
  {
    id: "zik-london-002",
    name: "Zik Camden",
    area: "North London",
    address: "Camden High Street",
    mapPosition: { left: "62%", top: "25%" }
  },
  {
    id: "zik-london-003",
    name: "Zik Shoreditch",
    area: "East London",
    address: "Old Street",
    mapPosition: { left: "70%", top: "66%" }
  }
];

const showDevTools = process.env.NODE_ENV !== "production";

const rejectedEnrollmentStatuses: EnrollmentRecord["status"][] = [
  "declined_physical_verification",
  "declined_identity_mismatch",
  "declined_no_adult_signal",
  "declined_bank_control_failed",
  "declined_duplicate_application"
];

function isRejectedEnrollment(status: EnrollmentRecord["status"]): boolean {
  return rejectedEnrollmentStatuses.includes(status);
}

function isCoolingEnrollment(status: EnrollmentRecord["status"]): boolean {
  return status === "approved_with_cooling_off" || status === "credential_pending_issuance";
}

function isRetryableEnrollment(status: EnrollmentRecord["status"]): boolean {
  return status === "retry_provider_failure";
}

export function WalletSurface({
  onboardingMode = false,
  homepageMode = false,
  onboardingHref = "/onboarding" as Route
}: {
  onboardingMode?: boolean;
  homepageMode?: boolean;
  onboardingHref?: Route;
} = {}) {
  type HeroViewMode = "how_to_get" | "how_it_works" | "parental_controls";
  type DeleteButtonState = "idle" | "deleted";
  const searchParams = useSearchParams();
  const entryContext = useMemo(() => parseWalletEntryContext(searchParams), [searchParams]);
  const physicalEntryExplicit = useMemo(
    () =>
      onboardingMode
        ? getOnboardingEntryMode(searchParams) === "affiliate"
        : searchParams.get("flow") === "physical" ||
          Boolean(searchParams.get("session_id")) ||
          Boolean(searchParams.get("store_id")),
    [onboardingMode, searchParams]
  );
  const [wallet, setWallet] = useState<WalletState>({});
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);
  const [physicalSession, setPhysicalSession] = useState<PhysicalStoreSessionRecord | null>(null);
  const [selectedAffiliateStoreId, setSelectedAffiliateStoreId] = useState<string | null>(null);
  const [onboardingStarted, setOnboardingStarted] = useState(false);
  const [step, setStep] = useState<FlowStep>("full-name");
  const [journeyState, setJourneyState] = useState<JourneyState>("idle");
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [possessionCode, setPossessionCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasTriedHeroSubmit, setHasTriedHeroSubmit] = useState(false);
  const [heroViewMode, setHeroViewMode] = useState<HeroViewMode>("how_to_get");
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [heroWorksSlideIndex, setHeroWorksSlideIndex] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [deleteButtonState, setDeleteButtonState] = useState<DeleteButtonState>("idle");
  const [isStatusDockOpen, setIsStatusDockOpen] = useState(false);
  const [deviceAuthMethod, setDeviceAuthMethod] = useState<"webauthn" | "demo_device_check">(
    "demo_device_check"
  );
  const [deviceAuthSummary, setDeviceAuthSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const physicalEnrollmentStartRef = useRef<string | null>(null);

  const credential = wallet.credential;
  const currentLane =
    enrollment?.lane ??
    wallet.enrollmentLane ??
    credential?.payload.issuance_channel ??
    (entryContext.lane === "physical" ? "physical" : "remote");
  const credentialExperience = getCredentialExperienceVariant(credential?.payload);
  const isPhysicalLane = currentLane === "physical" || credentialExperience === "physical";
  const activationTime = credential
    ? new Date(credential.payload.activates_at).getTime()
    : enrollment
      ? new Date(enrollment.cooling_off.ends_at).getTime()
      : 0;
  const remainingSeconds = activationTime
    ? Math.max(Math.ceil((activationTime - nowMs) / 1000), 0)
    : 0;
  const active = credential ? activationTime <= nowMs : false;
  const walletStatus = getWalletStatusSnapshot(wallet, enrollment, new Date(nowMs));
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
  const canDeleteLocalPass =
    Boolean(credential) ||
    Boolean(wallet.holderKeyPair) ||
    Boolean(wallet.enrollmentId) ||
    walletStatus.status === "pass_pending_issuance" ||
    walletStatus.status === "pass_expired";
  const heroFirstNameValid = answers.firstName.trim().length > 0;
  const heroLastNameValid = answers.lastName.trim().length > 0;
  const heroDateOfBirthValid = isValidDate(answers.dateOfBirth);
  const heroFormValid = heroFirstNameValid && heroLastNameValid && heroDateOfBirthValid;
  const heroFirstNameInvalid = hasTriedHeroSubmit && !heroFirstNameValid;
  const heroLastNameInvalid = hasTriedHeroSubmit && !heroLastNameValid;
  const heroDateOfBirthInvalid = hasTriedHeroSubmit && !heroDateOfBirthValid;
  const canStartFromHero = heroFormValid && !walletStatus.blocks_new_pass && !isPending;

  const applyEnrollment = useCallback(async (nextEnrollment: EnrollmentRecord) => {
    setEnrollment(nextEnrollment);
    if (nextEnrollment.physical_verification) {
      setDeviceAuthSummary(
        nextEnrollment.physical_verification.device_auth.verified_at
          ? "Device authentication completed on this device."
          : null
      );
    }

    if (nextEnrollment.issued_credential) {
      const nextWallet = await storeCredential(nextEnrollment.issued_credential, nextEnrollment.id);
      setWallet(nextWallet);
    }
  }, []);

  const syncPhysicalEnrollmentState = useCallback(async (nextEnrollment: EnrollmentRecord) => {
    await applyEnrollment(nextEnrollment);

    if (
      nextEnrollment.status === "verification_session_expired" ||
      nextEnrollment.physical_verification?.status === "expired"
    ) {
      setJourneyState("rejected");
      setStep("rejected");
      if (!onboardingMode) {
        setIsFlowOpen(true);
      }
      setError(nextEnrollment.last_user_message ?? "This in-store verification session expired.");
      return;
    }

    if (
      nextEnrollment.status === "declined_physical_verification" ||
      nextEnrollment.physical_verification?.status === "rejected"
    ) {
      setJourneyState("rejected");
      setStep("rejected");
      if (!onboardingMode) {
        setIsFlowOpen(true);
      }
      setError(nextEnrollment.last_user_message ?? "Store staff could not confirm this age check.");
      return;
    }

    if (nextEnrollment.status === "issued") {
      setJourneyState("pass_issued");
      setStep("success");
      return;
    }

    if (nextEnrollment.status === "physical_verification_pending") {
      setJourneyState("awaiting_clerk_verification");
      setStep("physical-verification");
      if (!onboardingMode) {
        setIsFlowOpen(true);
      }
      return;
    }

    if (nextEnrollment.status === "device_auth_pending") {
      setJourneyState("device_auth_required");
      setStep("device-auth");
      if (!onboardingMode) {
        setIsFlowOpen(true);
      }
      return;
    }

    if (isCoolingEnrollment(nextEnrollment.status)) {
      setJourneyState("physical_verification_complete");
      if (nextEnrollment.cooling_off.duration_seconds > 0 && !nextEnrollment.issued_credential) {
        setStep("cooling");
      } else {
        setStep("cooling");
      }
      return;
    }

    setJourneyState("pass_issued");
    setStep("success");
  }, [applyEnrollment, onboardingMode]);

  const syncFromEnrollment = useCallback(async (nextEnrollment: EnrollmentRecord) => {
    if (nextEnrollment.lane === "physical") {
      await syncPhysicalEnrollmentState(nextEnrollment);
      return;
    }

    await applyEnrollment(nextEnrollment);

    if (isRejectedEnrollment(nextEnrollment.status)) {
      setJourneyState("rejected");
      setStep("rejected");
      if (!onboardingMode) {
        setIsFlowOpen(true);
      }
      setError(nextEnrollment.last_user_message ?? null);
      return;
    }

    if (nextEnrollment.status === "bank_verification_pending") {
      setJourneyState("bank_verification_pending");
      setStep("bank-verification");
      return;
    }

    if (isRetryableEnrollment(nextEnrollment.status)) {
      setJourneyState("bank_verification_pending");
      setStep("bank-verification");
      setError(nextEnrollment.last_user_message ?? "We could not complete your check right now.");
      return;
    }

    if (
      nextEnrollment.status === "approved_pending_review" ||
      nextEnrollment.status === "manual_review_required"
    ) {
      setJourneyState("rejected");
      setStep("rejected");
      if (!onboardingMode) {
        setIsFlowOpen(true);
      }
      return;
    }

    if (isCoolingEnrollment(nextEnrollment.status)) {
      setJourneyState("cooling_off_pending");
      setStep("cooling");
      return;
    }

    setJourneyState("pass_issued");
    setStep("success");
  }, [applyEnrollment, onboardingMode, syncPhysicalEnrollmentState]);

  const refreshEnrollment = useCallback(
    async (enrollmentId: string) => {
      try {
        const response = await fetch(`/api/enrollment/${enrollmentId}`);
        const data = (await response.json()) as EnrollmentRecord | ApiError;

        if (!response.ok) {
          setError((data as ApiError).error);
          return;
        }

        await syncFromEnrollment(data as EnrollmentRecord);
      } catch {
        setError("We could not refresh this Zik Pass state right now.");
      }
    },
    [syncFromEnrollment]
  );

  const refreshPhysicalSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/physical/sessions/${sessionId}`);
      const data = (await response.json()) as PhysicalStoreSessionRecord | ApiError;

      if (!response.ok) {
        setError((data as ApiError).error);
        return;
      }

      setPhysicalSession(data as PhysicalStoreSessionRecord);
      setJourneyState("physical_session_detected");
      setStep("physical-session");
      setIsFlowOpen(true);
      setError(null);
    } catch {
      setError("We could not load the in-store session.");
    }
  }, []);

  const createPhysicalSessionFromEntry = useCallback(async (selectedStore?: AffiliateStore) => {
    try {
      const response = await fetch("/api/physical/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: selectedStore?.id ?? (entryContext.lane === "physical" ? entryContext.store_id : undefined),
          storeName:
            selectedStore?.name ?? (entryContext.lane === "physical" ? entryContext.store_name : undefined),
          locationId:
            selectedStore ? "front-desk" : entryContext.lane === "physical" ? entryContext.location_id : undefined
        })
      });
      const data = (await response.json()) as PhysicalStoreSessionRecord | ApiError;

      if (!response.ok) {
        throw new Error((data as ApiError).error);
      }

      setPhysicalSession(data as PhysicalStoreSessionRecord);
      setJourneyState("physical_session_detected");
      setStep("physical-session");
      setIsFlowOpen(true);
      setError(null);
    } catch {
      setError("We could not start the in-store session for this store.");
    }
  }, [entryContext]);

  useEffect(() => {
    void (async () => {
      try {
        setNowMs(Date.now());

        const walletState = await loadWalletState();
        setWallet(walletState);

        if (walletState.enrollmentId) {
          await refreshEnrollment(walletState.enrollmentId);
          return;
        }

        if (entryContext.lane === "physical" && physicalEntryExplicit) {
          if (entryContext.session_id) {
            await refreshPhysicalSession(entryContext.session_id);
          } else {
            await createPhysicalSessionFromEntry();
          }
          return;
        }

        if (walletState.credential) {
          const walletActivationTime = new Date(walletState.credential.payload.activates_at).getTime();
          const walletIsActive = walletActivationTime <= Date.now();
          setJourneyState(walletIsActive ? "pass_issued" : "cooling_off_pending");
          setStep(walletIsActive ? "success" : "cooling");
          return;
        }

      } catch {
        setError("We could not load the local Zik Pass on this browser.");
      }
    })();
  }, [
    createPhysicalSessionFromEntry,
    entryContext,
    onboardingMode,
    physicalEntryExplicit,
    refreshEnrollment,
    refreshPhysicalSession
  ]);

  const physicalSessionId =
    enrollment?.physical_verification?.session.session_id ?? physicalSession?.session_id;

  useEffect(() => {
    if (!physicalSessionId) {
      return;
    }

    const sendHeartbeat = () => {
      void fetch("/api/physical/sessions/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: physicalSessionId })
      }).catch(() => {
        // The clerk can still rely on the server session state if a heartbeat is missed.
      });
    };

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 5000);
    return () => window.clearInterval(interval);
  }, [physicalSessionId]);

  useEffect(() => {
    if (canDeleteLocalPass) {
      setDeleteButtonState("idle");
    }
  }, [canDeleteLocalPass]);

  useEffect(() => {
    if (!activationTime) {
      return;
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activationTime]);

  useEffect(() => {
    if (!enrollment?.id) {
      return;
    }

    if (
      enrollment.status !== "bank_verification_pending" &&
      enrollment.status !== "physical_verification_pending" &&
      enrollment.status !== "device_auth_pending" &&
      enrollment.status !== "approved_with_cooling_off" &&
      enrollment.status !== "retry_provider_failure" &&
      enrollment.status !== "credential_pending_issuance"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshEnrollment(enrollment.id);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [enrollment?.id, enrollment?.status, refreshEnrollment, step]);

  useEffect(() => {
    if (step !== "cooling" || !credential || !active) {
      return;
    }

    setJourneyState("activation_ready");

    const timer = window.setTimeout(() => {
      setJourneyState("pass_issued");
      setStep("success");
    }, 700);

    return () => window.clearTimeout(timer);
  }, [active, credential, step]);

  useEffect(() => {
    if (heroViewMode === "parental_controls") {
      return;
    }

    const interval = window.setInterval(() => {
      if (heroViewMode === "how_to_get") {
        setHeroSlideIndex((current) => (current + 1) % heroSlides.length);
        return;
      }

      const slideCount = isPhysicalLane
        ? physicalHowZikPassWorksSlides.length
        : howZikPassWorksSlides.length;
      setHeroWorksSlideIndex((current) => (current + 1) % slideCount);
    }, heroViewMode === "how_to_get" ? 15000 : 30000);

    return () => window.clearInterval(interval);
  }, [heroViewMode, isPhysicalLane]);

  useEffect(() => {
    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
      setDeviceAuthMethod("demo_device_check");
      return;
    }

    void (async () => {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setDeviceAuthMethod(available ? "webauthn" : "demo_device_check");
      } catch {
        setDeviceAuthMethod("demo_device_check");
      }
    })();
  }, []);

  function setSuccess() {
    setError(null);
  }

  function openFlow() {
    setError(null);
    setIsFlowOpen(true);

    if (!enrollment && !credential) {
      if (entryContext.lane === "physical" || physicalSession) {
        setJourneyState("physical_session_detected");
        setStep("physical-session");
        return;
      }

      setJourneyState("collecting_details");
      setStep("full-name");
    }
  }

  function startFromHero() {
    setHasTriedHeroSubmit(true);

    if (walletStatus.blocks_new_pass) {
      setError("This device already holds a Zik Pass. Delete it from this device before requesting a new one.");
      return;
    }

    if (walletStatus.status === "pass_pending_issuance" || enrollment) {
      openFlow();
      return;
    }

    if (onboardingMode) {
      setOnboardingStarted(true);
      setError(null);

      if (!physicalSession) {
        const selectedStore = affiliateStores.find((store) => store.id === selectedAffiliateStoreId);
        if (isPhysicalLane && !physicalEntryExplicit && !selectedStore) {
          setError("Select an affiliate store before beginning.");
          return;
        }

        setIsFlowOpen(true);
        void createPhysicalSessionFromEntry(selectedStore);
        return;
      }
    }

    if (!isPhysicalLane && !heroFormValid) {
      return;
    }

    setError(null);
    if (entryContext.lane === "physical" && !physicalSession) {
      setError("We are still creating your in-store session. Try again in a moment.");
      return;
    }

    setJourneyState(entryContext.lane === "physical" ? "physical_session_detected" : "collecting_details");
    setStep(entryContext.lane === "physical" ? "physical-session" : "current-address");
    setIsFlowOpen(true);
  }

  function closeFlow() {
    setIsFlowOpen(false);
  }

  function resetFlow() {
    startTransition(() => {
      void (async () => {
        await clearWallet();
        const clearedWallet = await loadWalletState();
        setWallet(clearedWallet);
        setEnrollment(null);
        setPhysicalSession(null);
        setOnboardingStarted(false);
        setAnswers(initialAnswers);
        setHasTriedHeroSubmit(false);
        setPossessionCode("");
        setDeviceAuthSummary(null);
        setJourneyState("idle");
        setStep("full-name");
        setIsFlowOpen(false);
        setDeleteButtonState("deleted");
        setError(null);
      })();
    });
  }

  const startEnrollmentSubmission = useCallback(() => {
    setJourneyState("submitting");
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          if (walletStatus.blocks_new_pass) {
            throw new Error(
              "This device already holds a Zik Pass. Delete the local pass before starting a new application."
            );
          }

          const existingWallet = await loadWalletState();
          const nextWallet = await ensureHolderKeyPair(existingWallet);
          setWallet(nextWallet);
          const physicalContext =
            entryContext.lane === "physical"
              ? physicalSession
                ? {
                    session_id: physicalSession.session_id,
                    store_id: physicalSession.store_id,
                    store_name: physicalSession.store_name,
                    location_id: physicalSession.location_id
                  }
                : undefined
              : undefined;

          if (entryContext.lane === "physical" && !physicalContext) {
            throw new Error("A live in-store session is required before issuance can start.");
          }

          const response = await fetch("/api/enrollment/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identityMatch:
                entryContext.lane === "physical"
                  ? undefined
                  : {
                      first_name: answers.firstName.trim(),
                      last_name: answers.lastName.trim(),
                      date_of_birth: answers.dateOfBirth,
                      current_home_address: answers.currentHomeAddress.trim(),
                      previous_address:
                        answers.movedInLastThreeYears && answers.previousAddress.trim()
                          ? answers.previousAddress.trim()
                          : undefined
                    },
              bankName: entryContext.lane === "physical" ? undefined : answers.bankName,
              holderPublicKey: nextWallet.holderKeyPair?.publicKeyJwk,
              lane: entryContext.lane,
              physicalContext
            })
          });

          const data = (await response.json()) as EnrollmentRecord | ApiError;
          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          const nextEnrollment = data as EnrollmentRecord;
          const updatedWallet = await storeEnrollmentContext({
            enrollmentId: nextEnrollment.id,
            enrollmentLane: nextEnrollment.lane,
            physicalSessionId: nextEnrollment.physical_verification?.session.session_id
          });
          setWallet(updatedWallet);
          await syncFromEnrollment(nextEnrollment);
          if (
            nextEnrollment.status === "bank_verification_pending" ||
            nextEnrollment.status === "physical_verification_pending"
          ) {
            setError(null);
          }
        } catch (err) {
          setJourneyState(entryContext.lane === "physical" ? "physical_session_detected" : "collecting_details");
          setError(err instanceof Error ? err.message : "Unable to start enrollment.");
        }
      })();
    });
  }, [
    answers.bankName,
    answers.currentHomeAddress,
    answers.dateOfBirth,
    answers.firstName,
    answers.lastName,
    answers.movedInLastThreeYears,
    answers.previousAddress,
    entryContext.lane,
    physicalSession,
    startTransition,
    syncFromEnrollment,
    walletStatus.blocks_new_pass
  ]);

  useEffect(() => {
    if (
      (!physicalEntryExplicit && (!onboardingMode || !onboardingStarted)) ||
      !physicalSession ||
      enrollment ||
      credential ||
      isPending ||
      walletStatus.blocks_new_pass
    ) {
      return;
    }

    if (physicalEnrollmentStartRef.current === physicalSession.session_id) {
      return;
    }

    physicalEnrollmentStartRef.current = physicalSession.session_id;
    startEnrollmentSubmission();
  }, [
    credential,
    enrollment,
    isPending,
    onboardingMode,
    onboardingStarted,
    physicalEntryExplicit,
    physicalSession,
    startEnrollmentSubmission,
    walletStatus.blocks_new_pass
  ]);

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
          if (nextEnrollment.bank_verification.transaction_status !== "confirmed") {
            await syncFromEnrollment(nextEnrollment);
            return;
          }

          await syncFromEnrollment(nextEnrollment);
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

          await syncFromEnrollment(data as EnrollmentRecord);
          setSuccess();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to advance cooling-off.");
        }
      })();
    });
  }

  function startDeviceAuthentication() {
    if (!enrollment) {
      return;
    }

    setError(null);
    setDeviceAuthSummary(null);

    startTransition(() => {
      void (async () => {
        try {
          const startResponse = await fetch("/api/physical/device-auth/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enrollmentId: enrollment.id })
          });
          const startData = (await startResponse.json()) as PhysicalDeviceAuthStartResponse | ApiError;

          if (!startResponse.ok) {
            throw new Error((startData as ApiError).error);
          }

          const { challenge_id, challenge } = startData as PhysicalDeviceAuthStartResponse;
          const method: "webauthn" | "demo_device_check" = deviceAuthMethod;
          let webauthnCredentialId: string | undefined;
          let clientDataJson: string | undefined;

          if (deviceAuthMethod === "webauthn") {
            const challengeBytes = base64UrlToBytes(challenge);
            const challengeBuffer = new Uint8Array(Array.from(challengeBytes));
            const publicKey = {
              challenge: challengeBuffer,
              rpId: window.location.hostname,
              timeout: 60000,
              userVerification: "required" as const
            };
            const credentialResult = (await navigator.credentials.get({
              publicKey
            })) as PublicKeyCredential | null;

            if (!credentialResult) {
              throw new Error("WebAuthn did not return a device authentication result.");
            }

            webauthnCredentialId = credentialResult.id;
            const assertion = credentialResult.response as AuthenticatorAssertionResponse;
            clientDataJson = btoa(
              String.fromCharCode(...new Uint8Array(assertion.clientDataJSON))
            )
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/g, "");
          }

          const completeResponse = await fetch("/api/physical/device-auth/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enrollmentId: enrollment.id,
              challengeId: challenge_id,
              method,
              webauthnCredentialId,
              clientDataJson
            })
          });

          const completeData = (await completeResponse.json()) as EnrollmentRecord | ApiError;

          if (!completeResponse.ok) {
            throw new Error((completeData as ApiError).error);
          }

          setDeviceAuthSummary(
            method === "webauthn"
              ? "Device authentication completed with WebAuthn."
              : "Device authentication completed using the demo device check."
          );
          await syncFromEnrollment(completeData as EnrollmentRecord);
        } catch (err) {
          setJourneyState("device_auth_required");
          setStep("device-auth");
          setError(err instanceof Error ? err.message : "Unable to complete device authentication.");
        }
      })();
    });
  }

  function retryProviderChecks() {
    if (!enrollment) {
      return;
    }

    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/enrollment/retry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enrollmentId: enrollment.id })
          });

          const data = (await response.json()) as EnrollmentRecord | ApiError;
          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          await syncFromEnrollment(data as EnrollmentRecord);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to retry provider checks.");
        }
      })();
    });
  }

  const totalQuestions = isPhysicalLane
    ? 1
    : answers.movedInLastThreeYears
      ? 7
      : 6;
  const statusMeta =
    credential
      ? [
        { label: "Pass ID", value: credential.payload.credential_id },
        { label: "Issued via", value: formatIssuanceChannel(credential.payload.issuance_channel) },
        {
          label: "Status",
          value: walletStatus.credential_expired
            ? "Expired"
            : active
              ? "Ready for age checks"
              : `Activates in ${remainingSeconds}s`
        },
        {
          label: "Stored",
          value:
            wallet.localCredentialStoredAt
              ? formatDateLabel(wallet.localCredentialStoredAt, "On this device")
              : "On this device"
        }
      ]
      : walletStatus.status === "pass_pending_issuance"
        ? [
            { label: "Status", value: "Pending issuance" },
            {
              label: "Type",
              value: isPhysicalLane ? "In-person verification" : "Remote verification"
            },
            { label: "Storage", value: "Holder key on this device" }
          ]
        : isPhysicalLane
          ? [
              { label: "Flow", value: "In-store verification" },
              { label: "Staff step", value: "Clerk confirms physical ID" }
            ]
          : [
              { label: "ID required", value: "No photo ID" },
              { label: "Credit impact", value: "Soft check only" },
              { label: "Bank step", value: "Refundable GBP 0.01" }
            ];
  const showHeroPassPreview = Boolean(credential) || walletStatus.status === "pass_pending_issuance";
  const activeHeroSlide = isPhysicalLane
    ? {
        pill: "In-store verification",
        title:
          "Anonymous online ID. Physically verified.\nWithout needing to digitise your Identity.",
        body: physicalHeroBulletPoints.join(". ")
      }
    : heroSlides[heroSlideIndex];
  const activeHowItWorksSlides = isPhysicalLane
    ? physicalHowZikPassWorksSlides
    : howZikPassWorksSlides;
  const activeHowItWorksIndex = heroWorksSlideIndex % activeHowItWorksSlides.length;
  const issuedZignatureSeed = credential
    ? buildCredentialZignatureSeedInput({
        credentialId: credential.payload.credential_id,
        subjectPublicKey: credential.payload.subject_public_key
      })
    : null;
  const pendingZignatureSeed = enrollment
    ? `pending:${enrollment.id}:${stableStringify(enrollment.holder_public_key)}`
    : null;
  const showPhysicalV2Flow = physicalEntryExplicit;

  if (showPhysicalV2Flow) {
    return (
      <div className="relative min-h-screen">
        <PhysicalOnboardingExperience
          credential={credential}
          deviceAuthMethod={deviceAuthMethod}
          deviceAuthSummary={deviceAuthSummary}
          enrollment={enrollment}
          error={error}
          isPending={isPending}
          physicalSession={physicalSession}
          step={step}
          remainingSeconds={remainingSeconds}
          coolingProgress={coolingProgress}
          issuedZignatureSeed={issuedZignatureSeed}
          pendingZignatureSeed={pendingZignatureSeed}
          onAuthenticateDevice={startDeviceAuthentication}
          onReset={resetFlow}
        />
        <WalletStatusFooter
          canDeleteLocalPass={canDeleteLocalPass}
          deleteButtonState={deleteButtonState}
          isOpen={isStatusDockOpen}
          onReset={resetFlow}
          onToggle={() => setIsStatusDockOpen((current) => !current)}
          status={walletStatus}
          statusMeta={statusMeta}
        />
      </div>
    );
  }

  return (
    <div
      className={`${homepageMode ? "mt-[100px] " : ""}grid gap-6 pb-52 sm:pb-44 lg:pb-32`}
    >
      <section className="relative overflow-hidden rounded-[40px] border border-white/80 bg-white/72 px-6 py-8 shadow-panel backdrop-blur-sm sm:px-10 sm:py-10">
        <div
          className={`relative grid gap-8 md:items-start ${
            onboardingMode ? "md:grid-cols-1" : "md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
          }`}
        >
          <div className="relative md:order-1">
            <div className="absolute inset-0 translate-x-5 translate-y-5 rounded-[34px] bg-lime/35" />
            <div className="relative overflow-hidden rounded-[34px] border border-ink/8 bg-white p-6 shadow-[0_30px_80px_rgba(14,23,38,0.18)]">
              <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,_rgba(215,241,113,0.3),_transparent_45%)]" />
              <div className="relative space-y-6">
                <div className="mb-8 flex items-center justify-between gap-4">
                  <div>
                    <p className="mt-2 font-heading text-3xl font-semibold tracking-tight text-ink">
                      {onboardingMode
                        ? "Customer Onboarding"
                        : isPhysicalLane
                          ? "Verify offline, use online. No digital footpwinx"
                          : "Zero Knowledge age verification"}
                    </p>
                    {!showHeroPassPreview && !onboardingMode ? (
                      <p className="mt-2 font-mono text-xs tracking-[0.24em] text-ink/45">
                        {isPhysicalLane
                          ? "This store session will issue a stronger-assurance Zik Pass to this device."
                          : "Apply below to get your Zik Pass, or click learn more for how it works"}
                      </p>
                    ) : null}
                  </div>
                  <div className="animate-float-slow rounded-[24px] border border-ink/8 bg-[#f6faea] p-3">
                    <ZikLogoMark className="h-10 w-10 text-ink" />
                  </div>
                </div>

                {credential ? (
                  <div className="rounded-[28px] border border-ink/8 bg-[#f7faee] p-5">
                    <p className="font-heading text-2xl font-semibold tracking-tight text-ink">Your pass</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <MetaTile
                        label="Status"
                        value={
                          walletStatus.credential_expired
                            ? "Expired"
                            : walletStatus.credential_active
                              ? "Issued"
                              : "Pending"
                        }
                      />
                      <MetaTile
                        label="Issued At"
                        value={formatDateLabel(credential.payload.issued_at, "Unavailable")}
                      />
                    </div>
                    {homepageMode ? (
                      <Link
                        className="mt-4 inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist transition hover:bg-[#24364d]"
                        href="/wallet"
                      >
                        View pass
                      </Link>
                    ) : null}
                  </div>
                ) : walletStatus.status === "pass_pending_issuance" ? (
                  <div className="grid gap-5">
                    {!homepageMode ? (
                      <CredentialVisualPreview
                        title="Pass pending issuance"
                        body={
                          isPhysicalLane
                            ? "This device already holds the private holder key for the in-person verified pass. Zik will issue it after staff verification and device authentication are complete."
                            : "This device already holds the private holder key for your Zik Pass. Zik will sign the credential and lock in the final Zignature when issuance is complete."
                        }
                        seedInput={pendingZignatureSeed ?? "pending"}
                        variant="compact"
                        muted
                      />
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MetaTile label="Status" value="Pending issuance" />
                      <MetaTile
                        label="Type"
                        value={isPhysicalLane ? "In-store verification" : "Remote verification"}
                      />
                      <MetaTile
                        label={isPhysicalLane ? "ID Challenge" : "Privacy"}
                        value={isPhysicalLane ? "Staff + device auth required" : "No account required"}
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-mist"
                        onClick={openFlow}
                      >
                        View application
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {isPhysicalLane ? (
                      onboardingMode && !physicalEntryExplicit ? (
                        <div className="rounded-[26px] bg-[#f7faee] p-5 text-sm text-ink/76">
                          <p className="font-medium text-ink">Select a store</p>
                          <AffiliateStoreSelector
                            selectedStoreId={selectedAffiliateStoreId}
                            onSelect={setSelectedAffiliateStoreId}
                          />
                        </div>
                      ) : (
                        <div className="rounded-[26px] bg-[#f7faee] p-5 text-sm text-ink/76">
                          <p className="font-medium text-ink">This store session is ready</p>
                          <p className="mt-2 leading-6">
                            Create a local holder key, then show your temporary customer QR to a staff
                            member with your physical ID. Zik receives the age-check result, not your
                            identity details.
                          </p>
                        </div>
                      )
                    ) : (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FieldInput
                            invalid={heroFirstNameInvalid}
                            placeholder="First name"
                            value={answers.firstName}
                            onChange={(value) => {
                              setAnswers((current) => ({
                                ...current,
                                firstName: value
                              }));
                              setError(null);
                            }}
                          />
                          <FieldInput
                            invalid={heroLastNameInvalid}
                            placeholder="Last name"
                            value={answers.lastName}
                            onChange={(value) => {
                              setAnswers((current) => ({
                                ...current,
                                lastName: value
                              }));
                              setError(null);
                            }}
                          />
                        </div>

                        <FieldInput
                          invalid={heroDateOfBirthInvalid}
                          type="date"
                          value={answers.dateOfBirth}
                          onChange={(value) => {
                            setAnswers((current) => ({
                              ...current,
                              dateOfBirth: value
                            }));
                            setError(null);
                          }}
                        />
                      </>
                    )}

                    <div
                      className={
                        onboardingMode
                          ? "flex flex-col items-center justify-center gap-3 pt-[35px] text-center"
                          : isPhysicalLane
                            ? "flex flex-wrap gap-3 pt-[90px]"
                            : "flex flex-wrap gap-3"
                      }
                    >
                      {isPhysicalLane && !onboardingMode ? (
                        <Link
                          className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-mist transition"
                          href={onboardingHref}
                        >
                          Get Zik Pass
                        </Link>
                      ) : (
                        <button
                          className={`rounded-full font-semibold transition ${
                            onboardingMode
                              ? "mb-[20px] min-h-[82px] min-w-[150px] px-[34px] py-5 text-[26px]"
                              : "px-6 py-3 text-sm"
                          } ${
                            isPhysicalLane || canStartFromHero
                              ? "bg-ink text-mist"
                              : "cursor-default bg-ink/12 text-gray-300"
                          }`}
                          aria-disabled={isPhysicalLane ? undefined : !canStartFromHero}
                          disabled={isPending}
                          onClick={startFromHero}
                        >
                          {onboardingMode
                            ? "Begin"
                            : isPhysicalLane
                              ? "Continue in-store"
                              : "Get Zik Pass"}
                        </button>
                      )}
                      {onboardingMode ? (
                        <p className="mb-[50px] max-w-sm text-xs leading-5 text-ink/55">
                          A physical check of your ID will be made by the affiliate verifier
                        </p>
                      ) : null}
                      {!onboardingMode ? (
                        <button
                          className="rounded-full border border-ink/10 bg-[#f7faee] px-6 py-3 text-sm font-medium text-ink hover:bg-[#edf3df]"
                          onClick={() => setIsLearnMoreOpen(true)}
                        >
                          Learn more
                        </button>
                      ) : null}
                    </div>

                    {!onboardingMode && !homepageMode ? (
                      <div className="grid gap-4 rounded-[26px] bg-[#f7faee] p-5 sm:grid-cols-3">
                        {isPhysicalLane ? (
                          <>
                            <HeroMetric label="Assurance" value="In-person verified" dark />
                            <HeroMetric label="Staff step" value="Clerk confirms ID" dark />
                            <HeroMetric label="Stored" value="On this device" dark />
                          </>
                        ) : (
                          <>
                            <HeroMetric label="Soft check" value="No score impact" dark />
                            <HeroMetric label="Privacy" value="Over-18 only" dark />
                            <HeroMetric label="Stored" value="On device" dark />
                          </>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          {!onboardingMode ? (
            <div className="space-y-6 rounded-[32px] py-6 pl-[25px] md:order-2 md:flex md:self-stretch md:flex-col md:space-y-0 md:py-8">
            <div className="flex flex-wrap gap-2">
              <HeroViewTab
                active={heroViewMode === "how_to_get"}
                label="How to get your ZikPass"
                onClick={() => setHeroViewMode("how_to_get")}
              />
              <HeroViewTab
                active={heroViewMode === "parental_controls"}
                label="Zik Parental Controls"
                onClick={() => setHeroViewMode("parental_controls")}
              />
              {!homepageMode ? (
                <HeroViewTab
                  active={heroViewMode === "how_it_works"}
                  label="How ZikPass works"
                  onClick={() => setHeroViewMode("how_it_works")}
                />
              ) : null}
            </div>
            <div className="space-y-[13px] md:flex md:flex-1 md:flex-col md:justify-center">
              {heroViewMode === "how_to_get" ? (
                <>
                  <div
                    className={`${isPhysicalLane ? "mt-[30px]" : "-mt-[10px]"} min-h-[248px] space-y-4 sm:min-h-[272px]`}
                  >
                    <h2
                      className={`max-w-3xl font-heading font-semibold leading-[0.92] tracking-tight text-ink ${
                        isPhysicalLane ? "whitespace-pre-line" : ""
                      } ${
                        isPhysicalLane ? "text-[1.9rem] sm:text-[2.35rem]" : "text-5xl sm:text-6xl"
                      }`}
                    >
                      {activeHeroSlide.title}
                    </h2>
                    {isPhysicalLane ? (
                      <ul className="!mt-[26px] list-disc space-y-1 pl-5 text-base leading-8 text-ink/68">
                        {physicalHeroBulletPoints.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="max-w-2xl text-base leading-8 text-ink/68">
                        {activeHeroSlide.body}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-ink/70">
                    {isPhysicalLane ? (
                      <button
                        className="rounded-full bg-ink px-4 py-[10px] text-[12px] font-semibold text-mist transition hover:bg-[#24364d]"
                        onClick={() => setIsLearnMoreOpen(true)}
                        type="button"
                      >
                        Learn more
                      </button>
                    ) : (
                      heroSlides.map((slide, index) => (
                        <HeroSlidePill
                          key={slide.pill}
                          active={index === heroSlideIndex}
                          label={slide.pill}
                          onClick={() => setHeroSlideIndex(index)}
                        />
                      ))
                    )}
                  </div>
                </>
              ) : heroViewMode === "parental_controls" ? (
                <div className="-mt-[10px] min-h-[248px] space-y-4 sm:min-h-[272px]">
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/44">
                    Coming soon
                  </p>
                  <h2 className="max-w-3xl font-heading text-5xl font-semibold leading-[0.92] tracking-tight text-ink sm:text-6xl">
                    {parentalControlsSlide.title}
                  </h2>
                  <p className="max-w-2xl text-base leading-8 text-ink/68">
                    {parentalControlsSlide.body}
                  </p>
                  <Link
                    className="inline-flex w-fit rounded-full bg-ink px-4 py-[10px] text-[12px] font-semibold text-mist transition hover:bg-[#24364d]"
                    href="/ZikParental"
                  >
                    Learn more
                  </Link>
                </div>
              ) : (
                <>
                  <div className="min-h-[248px] overflow-hidden rounded-[28px] border border-ink/10 bg-white/74 shadow-[0_18px_40px_rgba(14,23,38,0.06)] sm:min-h-[272px]">
                    <div
                      className="flex h-full w-full transition-transform duration-500 ease-out"
                      style={{
                        transform: `translateX(-${activeHowItWorksIndex * 100}%)`
                      }}
                    >
                      {activeHowItWorksSlides.map((slide) => (
                        <div key={slide.label} className="w-full shrink-0 p-5 sm:p-6">
                          <div className="grid h-full gap-6 md:grid-cols-[1.05fr_0.95fr] md:items-center">
                            <div className="space-y-4">
                              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/44">
                                {slide.label}
                              </p>
                              <h2 className="max-w-3xl font-heading text-4xl font-semibold leading-[0.96] tracking-tight text-ink sm:text-5xl">
                                {slide.title}
                              </h2>
                              <p className="max-w-2xl text-base leading-8 text-ink/68">
                                {slide.body}
                              </p>
                            </div>
                            <HowItWorksGraphic art={slide.art} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-ink/70">
                    {activeHowItWorksSlides.map((slide, index) => (
                      <HeroSlidePill
                        key={slide.label}
                        active={index === activeHowItWorksIndex}
                        label={slide.label}
                        onClick={() => setHeroWorksSlideIndex(index)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            </div>
          ) : null}
        </div>
      </section>

      {!onboardingMode && !homepageMode ? (
        <div className="grid gap-6">
          <SurfaceCard
            title={isPhysicalLane ? "Why physical-first ZikPass" : "Why people choose Zik Pass"}
            subtitle={
              isPhysicalLane
                ? "Built around a normal in-person age check, then minimized into a reusable pass."
                : "Designed to feel more like a premium financial product than a compliance prompt."
            }
            className="border-ink/5 bg-white/88"
          >
          <ul className="grid gap-4">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef6df] text-sm font-semibold text-ink">
                ✓
              </span>
              <div>
                <p className="text-sm font-medium text-ink">
                  {isPhysicalLane ? "Familiar in-person check" : "Familiar first-time check"}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink/68">
                  {isPhysicalLane
                    ? "Show your physical ID to staff at a participating retailer, then keep using ZikPass online."
                    : "You answer a few normal identity questions, confirm a temporary bank reference, and receive the pass on the same device."}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef6df] text-sm font-semibold text-ink">
                ✓
              </span>
              <div>
                <p className="text-sm font-medium text-ink">Private by design</p>
                <p className="mt-1 text-sm leading-6 text-ink/68">
                  {isPhysicalLane
                    ? "Zik receives the staff-confirmed 18+ result, not your name, date of birth, address, ID number, or ID image."
                    : "Sites only learn that you are over 18. They do not receive your name, date of birth, or bank information."}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eef6df] text-sm font-semibold text-ink">
                ✓
              </span>
              <div>
                <p className="text-sm font-medium text-ink">
                  {isPhysicalLane ? "Stored on this device" : "Protection before first use"}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink/68">
                  {isPhysicalLane
                    ? "The signed in-person verified credential is bound to the holder public key created on this device."
                    : "A short activation delay gives you time to spot anything unexpected before the pass can be used."}
                </p>
              </div>
            </li>
          </ul>
          </SurfaceCard>
        </div>
      ) : null}

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
            {enrollment && !credential ? (
              <button
                className="rounded-full bg-ink/10 px-4 py-2 text-sm font-medium text-ink"
                disabled={isPending}
                onClick={advanceCoolingOff}
              >
                Complete cooling-off
              </button>
            ) : null}
          </div>
        </details>
      ) : null}

      <div
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end px-3 pb-10 transition-[height] duration-200 sm:px-6 lg:px-8 ${isStatusDockOpen ? "h-44" : "h-24"}`}
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(255,255,255,0.31) 0%, rgba(255,255,255,1) 50%, rgba(162,206,106,1) 100%)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% 100%"
        }}
      >
        <section
          aria-live="polite"
          className="pointer-events-auto mx-auto w-[85%] max-w-[1088px] rounded-[22px] bg-white/80 p-1.5 opacity-25 shadow-[0_-12px_36px_rgba(14,23,38,0.08)] transition-[opacity,background-image,background-color] duration-200 hover:bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(244,247,238,0.94))] hover:opacity-100 sm:p-2"
        >
          <div className="flex flex-wrap items-center gap-2 px-1 py-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/45">
                Your status
              </p>
              <StatusPill
                tone={
                  walletStatus.status === "pass_issued_and_stored_locally"
                    ? walletStatus.credential_active
                      ? "good"
                      : "neutral"
                    : walletStatus.status === "pass_expired"
                      ? "warn"
                      : walletStatus.status === "pass_pending_issuance"
                        ? "neutral"
                        : "neutral"
                }
              >
                {walletStatus.status === "pass_issued_and_stored_locally"
                  ? walletStatus.credential_active
                    ? "Active"
                    : "Activating"
                  : walletStatus.status === "pass_expired"
                    ? "Expired"
                    : walletStatus.status === "pass_pending_issuance"
                      ? "Pending issuance"
                      : "Not started"}
              </StatusPill>
              {canDeleteLocalPass || deleteButtonState === "deleted" ? (
                <button
                  className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-mist disabled:opacity-55"
                  disabled={deleteButtonState === "deleted"}
                  onClick={resetFlow}
                >
                  {deleteButtonState === "deleted"
                    ? "Deleted"
                    : "Delete Zik Pass from this device"}
                </button>
              ) : null}
            </div>
            <button
              aria-expanded={isStatusDockOpen}
              aria-label={isStatusDockOpen ? "Collapse wallet status details" : "Expand wallet status details"}
              className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink/10 bg-white text-sm font-semibold text-ink hover:bg-[#edf3df]"
              onClick={() => setIsStatusDockOpen((current) => !current)}
              title={isStatusDockOpen ? "Collapse status details" : "Expand status details"}
              type="button"
            >
              {isStatusDockOpen ? "-" : "+"}
            </button>
          </div>
          {isStatusDockOpen ? (
            <div className="mt-1 grid gap-1.5 sm:grid-cols-3 lg:min-w-[420px]">
              {statusMeta.map((item) => (
                <div className={item.label === "Flow" ? "hidden sm:block" : ""} key={item.label}>
                  <MetaTile label={item.label} value={item.value} />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {isFlowOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.18),rgba(14,23,38,0.64)_58%)] backdrop-blur-md"
          onClick={closeFlow}
        >
          <div className="flex h-full w-full flex-col items-stretch justify-center p-2 sm:p-6">
            <div
              className="relative mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-[30px] border border-white/65 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(244,247,238,0.97))] p-2 shadow-[0_36px_120px_rgba(14,23,38,0.28)] sm:rounded-[40px] sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                aria-label="Close Zik Pass form"
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-white text-lg text-ink hover:bg-[#f4f7ee] sm:right-4 sm:top-4 sm:h-11 sm:w-11 sm:text-xl"
                onClick={closeFlow}
              >
                ×
              </button>

              <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pr-0 sm:pr-2">
                {step === "physical-session" && (physicalSession || enrollment?.physical_verification) ? (
                  <FullscreenCard
                    eyebrow="You’re verifying in-store"
                    title={`Ready at ${physicalSession?.store_name ?? enrollment?.physical_verification?.session.store_name}`}
                    body="Your physical ID stays with you. Zik only receives an authorised confirmation that staff checked it and confirmed 18+."
                    actionLabel="Continue"
                    onAction={() => {
                      setJourneyState("collecting_details");
                      setStep("device-security");
                    }}
                  >
                    <div className="grid gap-4 sm:grid-cols-3">
                      <InlineDetail
                        title="Store session"
                        body={
                          physicalSession?.session_id ??
                          enrollment?.physical_verification?.session.session_id ??
                          "Session unavailable"
                        }
                      />
                      <InlineDetail
                        title="Staff step"
                        body="A staff member checks your physical ID in person."
                      />
                      <InlineDetail
                        title="Device rule"
                        body="Only this device receives the signed ZikPass."
                      />
                    </div>
                  </FullscreenCard>
                ) : null}

                {step === "full-name" && !isPhysicalLane ? (
                  <QuestionCard
                    step={`Question 1 of ${totalQuestions}`}
                    title="What is your full name?"
                    body={
                      isPhysicalLane
                        ? "Enter the name that should match the ID you will show in store."
                        : "Enter the name that should match your financial record."
                    }
                    canContinue={
                      answers.firstName.trim().length > 0 && answers.lastName.trim().length > 0
                    }
                    onBack={undefined}
                    onNext={() => {
                      setJourneyState("collecting_details");
                      setStep("date-of-birth");
                    }}
                  >
                    <IdentityCheckIntro lane={isPhysicalLane ? "physical" : "remote"} />
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

                {step === "date-of-birth" && !isPhysicalLane ? (
                  <QuestionCard
                    step={`Question 2 of ${totalQuestions}`}
                    title="What is your date of birth?"
                    body={
                      isPhysicalLane
                        ? "We use this alongside the ID check in store to prepare your stronger-assurance pass."
                        : "We use this to securely match the right record for your soft financial check."
                    }
                    canContinue={isValidDate(answers.dateOfBirth)}
                    onBack={() => setStep("full-name")}
                    onNext={() => setStep("current-address")}
                  >
                    <IdentityCheckIntro compact lane={isPhysicalLane ? "physical" : "remote"} />
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

                {step === "current-address" && !isPhysicalLane ? (
                  <QuestionCard
                    step={`Question 3 of ${totalQuestions}`}
                    title="What is your current home address?"
                    body={
                      isPhysicalLane
                        ? "Use the address that should match the ID and details you present in store."
                        : "Use the address where you currently live."
                    }
                    canContinue={answers.currentHomeAddress.trim().length > 0}
                    onBack={() => setStep("date-of-birth")}
                    onNext={() => setStep("moved-recently")}
                  >
                    <IdentityCheckIntro compact lane={isPhysicalLane ? "physical" : "remote"} />
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

                {step === "moved-recently" && !isPhysicalLane ? (
                  <QuestionCard
                    step={`Question 4 of ${totalQuestions}`}
                    title="Have you moved in the last 3 years?"
                    body={
                      isPhysicalLane
                        ? "If you have, we may need one previous address to support the in-store identity check."
                        : "If you have, we may need one previous address to improve the record match."
                    }
                    canContinue={typeof answers.movedInLastThreeYears === "boolean"}
                    onBack={() => setStep("current-address")}
                    onNext={() =>
                      setStep(
                        answers.movedInLastThreeYears
                          ? "previous-address"
                          : isPhysicalLane
                            ? "device-security"
                            : "bank-selection"
                      )
                    }
                  >
                    <IdentityCheckIntro compact lane={isPhysicalLane ? "physical" : "remote"} />
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

                {step === "previous-address" && !isPhysicalLane ? (
                  <QuestionCard
                    step={`Question 5 of ${totalQuestions}`}
                    title="What was your previous address?"
                    body={
                      isPhysicalLane
                        ? "Only provide this if you moved in the last 3 years."
                        : "Only provide this if you moved in the last 3 years."
                    }
                    canContinue={answers.previousAddress.trim().length > 0}
                    onBack={() => setStep("moved-recently")}
                    onNext={() => setStep(isPhysicalLane ? "device-security" : "bank-selection")}
                  >
                    <IdentityCheckIntro compact lane={isPhysicalLane ? "physical" : "remote"} />
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

                {step === "bank-selection" && !isPhysicalLane ? (
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
                    body={
                      isPhysicalLane
                        ? "We create a private holder key on this device now. Zik receives the public key and the store session only, then waits for staff to confirm the in-person age check."
                        : "We create a private holder key that stays on this device. Only the public key is used to issue your pass."
                    }
                    canContinue={!isPending}
                    error={error}
                    nextLabel={
                      isPending
                        ? "Starting secure check..."
                        : isPhysicalLane
                          ? "Show my customer QR"
                          : "Use Face ID, fingerprint or passcode"
                    }
                    onBack={() =>
                      setStep(isPhysicalLane ? "physical-session" : "bank-selection")
                    }
                    onNext={startEnrollmentSubmission}
                  >
                    <div className="rounded-[28px] bg-ink/5 p-5 text-sm text-ink/78">
                      <p className="font-medium text-ink">What happens next</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <InlineDetail title="Local key" body="Created on this device and kept private." />
                        <InlineDetail
                          title={isPhysicalLane ? "Store step" : "Soft check"}
                          body={
                            isPhysicalLane
                              ? "Staff will confirm your physical ID in person."
                              : "Looks for adult financial activity only."
                          }
                        />
                        <InlineDetail
                          title={isPhysicalLane ? "Device auth" : "No ID upload"}
                          body={
                            isPhysicalLane
                              ? "This device must complete authentication before issuance."
                              : "No passport, selfie, or biometric upload."
                          }
                        />
                      </div>
                    </div>
                  </QuestionCard>
                ) : null}

                {step === "physical-verification" && enrollment?.physical_verification ? (
                  <QuestionCard
                    step="In-store verification"
                    title="You’re ready to verify"
                    canContinue={false}
                    error={error}
                    nextLabel="Waiting for staff"
                    onBack={undefined}
                    onNext={() => undefined}
                  >
                    <PhysicalVerificationPanel
                      enrollment={enrollment}
                      physicalSession={physicalSession}
                    />
                  </QuestionCard>
                ) : null}

                {step === "device-auth" && enrollment?.physical_verification ? (
                  <QuestionCard
                    step="Device authentication"
                    title="Authenticate on this device"
                    body="The person being verified must complete device authentication on the device receiving the ZikPass."
                    canContinue={!isPending}
                    error={error}
                    nextLabel={isPending ? "Authenticating..." : "Complete device authentication"}
                    onBack={undefined}
                    onNext={startDeviceAuthentication}
                  >
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                      <div className="rounded-[28px] bg-ink p-5 text-mist">
                        <div className="flex flex-wrap items-center gap-3">
                          <StatusPill tone="good">
                            {enrollment.physical_verification.session.store_name}
                          </StatusPill>
                          <StatusPill tone="neutral">
                            {enrollment.physical_verification.clerk_verification.status === "verified"
                              ? "ID check confirmed"
                              : "Waiting for staff"}
                          </StatusPill>
                        </div>
                        <p className="mt-5 font-heading text-2xl font-semibold tracking-tight">
                          Choose the strongest device authentication available.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-mist/76">
                          WebAuthn will use your platform authenticator when available. The demo
                          device check keeps the architecture explicit when a full authenticator
                          prompt is not available in this browser.
                        </p>
                        {deviceAuthSummary ? (
                          <p className="mt-4 rounded-[20px] bg-white/10 px-4 py-3 text-sm text-mist/82">
                            {deviceAuthSummary}
                          </p>
                        ) : null}
                      </div>
                      <div className="rounded-[28px] bg-white p-5">
                        <p className="font-medium text-ink">Authentication method</p>
                        <div className="mt-4 grid gap-3">
                          <AnswerButton
                            active={deviceAuthMethod === "webauthn"}
                            label="WebAuthn"
                            detail="Use a platform authenticator if this device supports it."
                            onClick={() => setDeviceAuthMethod("webauthn")}
                          />
                          <AnswerButton
                            active={deviceAuthMethod === "demo_device_check"}
                            label="Demo device check"
                            detail="Use the production-shaped fallback for this sprint demo."
                            onClick={() => setDeviceAuthMethod("demo_device_check")}
                          />
                        </div>
                      </div>
                    </div>
                  </QuestionCard>
                ) : null}

                {step === "bank-verification" && enrollment ? (
                  <QuestionCard
                    step="Bank verification"
                    title="Enter the 6-digit code from your banking app."
                    body={
                      enrollment.status === "retry_provider_failure"
                        ? "We hit a temporary provider problem while preparing your bank check. Retry to continue safely."
                        : "This temporary refundable authorisation confirms you control a real adult-linked bank account."
                    }
                    canContinue={
                      enrollment.status === "bank_verification_pending" &&
                      possessionCode.trim().length === 6 &&
                      !isPending
                    }
                    error={error}
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
                    {enrollment.status === "retry_provider_failure" ? (
                      <div className="mt-4">
                        <button
                          className="rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-medium text-ink"
                          disabled={isPending}
                          onClick={retryProviderChecks}
                        >
                          {isPending ? "Retrying..." : "Retry provider checks"}
                        </button>
                      </div>
                    ) : null}
                  </QuestionCard>
                ) : null}

                {step === "cooling" && enrollment ? (
                  <FullscreenCard
                    eyebrow={isPhysicalLane ? "Issuance in progress" : "Cooling-off in progress"}
                    title={
                      isPhysicalLane
                        ? "Your in-person verification is complete. Zik is issuing your pass."
                        : "Your device is ready. Zik will sign your pass after cooling-off."
                    }
                    body={
                      isPhysicalLane
                        ? "Your private holder key is already stored on this device. Zik will issue the stronger-assurance pass as soon as the lane policy is satisfied."
                        : "Your private holder key is already stored on this device. We wait until cooling-off ends before signing and delivering the credential locally."
                    }
                    showPassPreview
                    passPreviewEmphasis
                  >
                    <div className="grid min-w-0 gap-4">
                      <PassPreviewCard
                        credentialId={credential?.payload.credential_id ?? enrollment.id}
                        active={false}
                        zignatureSeedInput={
                          issuedZignatureSeed ?? pendingZignatureSeed ?? enrollment.id
                        }
                      />
                      <div className="rounded-[28px] bg-white p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-heading text-2xl font-semibold tracking-tight text-ink">
                              {remainingSeconds > 0
                                ? `Cooling-off ends in ${remainingSeconds}s`
                                : isPhysicalLane
                                  ? "Waiting for issuer signature"
                                  : "Waiting for issuer signature"}
                            </p>
                            <p className="mt-1 text-sm text-ink/68">
                              You can come back at any time. No account is required, and your
                              identity details are not included in the pass that will be stored on
                              this device.
                            </p>
                          </div>
                          <StatusPill tone="neutral">
                            {isPhysicalLane ? "In-person lane policy" : "Cooling-off protection"}
                          </StatusPill>
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
                        <MetaTile
                          label="Assurance"
                          value={isPhysicalLane ? "In-person verified" : "Remote standard"}
                        />
                        <MetaTile label="Storage" value="Holder key already on device" />
                      </div>
                    </div>
                  </FullscreenCard>
                ) : null}

                {step === "success" && credential ? (
                  <FullscreenCard
                    eyebrow="Zik Pass ready"
                    title="Your Zik Pass is ready."
                    body={
                      credential.payload.issuance_channel === "physical"
                        ? "Your in-person verified Zik Pass is now stored on this device with a stronger assurance level."
                        : "You can now verify that you are over 18 without sharing photo ID, your date of birth, or your name."
                    }
                    showPassPreview
                    actionLabel="Done"
                    actionClassName="h-[150px] w-full max-w-[400px] items-center justify-center bg-[linear-gradient(135deg,_#7cb56b,_#a2ce6a)] px-5 py-4 text-center text-3xl text-white transition-[filter] hover:brightness-95 sm:w-[400px] sm:px-8 sm:text-4xl"
                    actionAside
                    actionHref="/wallet"
                  >
                    <div className="grid gap-4">
                      <PassPreviewCard
                        credentialId={credential.payload.credential_id}
                        active
                        zignatureSeedInput={issuedZignatureSeed ?? credential.payload.credential_id}
                      />
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MetaTile label="Status" value="Ready for age checks" />
                        <MetaTile
                          label="Assurance"
                          value={formatAssuranceLevel(credential.payload.assurance_level)}
                        />
                        <MetaTile
                          label="Issued via"
                          value={formatIssuanceChannel(credential.payload.issuance_channel)}
                        />
                      </div>
                      <div className="rounded-[28px] bg-white p-5 text-sm text-ink/76">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <InlineDetail
                            title="What sites see"
                            body={
                              credential.payload.issuance_channel === "physical"
                                ? "A valid over-18 confirmation with in-person verified assurance."
                                : "A valid over-18 confirmation."
                            }
                          />
                          <InlineDetail
                            title="What stays private"
                            body="Your identity, address, and verification inputs."
                          />
                          <InlineDetail
                            title="What issued it"
                            body={
                              credential.payload.issuance_channel === "physical"
                                ? "An in-store verification with clerk confirmation and device auth."
                                : "A remote verification with Zik issuer signing."
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </FullscreenCard>
                ) : null}

                {step === "rejected" && enrollment ? (
                  <FullscreenCard
                    eyebrow={
                      enrollment.status === "approved_pending_review" ||
                      enrollment.status === "manual_review_required"
                        ? "Additional review"
                        : "Unable to issue"
                    }
                    title={
                      enrollment.status === "approved_pending_review" ||
                      enrollment.status === "manual_review_required"
                        ? "This application needs additional review."
                        : "We could not issue a Zik Pass from this check."
                    }
                    body={
                      enrollment.last_user_message ??
                      "The eligibility check did not meet the current threshold. You can review the details and try again."
                    }
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
                        {(enrollment.risk_decision.reasons.length > 0
                          ? enrollment.risk_decision.reasons
                          : enrollment.proof_evaluation.reasons
                        ).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </FullscreenCard>
                ) : null}
              </div>

            </div>

            <div className="mx-auto mt-[30px] w-full max-w-7xl shrink-0">
              <JourneyTracker lane={isPhysicalLane ? "physical" : "remote"} state={journeyState} />
            </div>
          </div>
        </div>
      ) : null}

      {isLearnMoreOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.16),rgba(14,23,38,0.62)_56%)] backdrop-blur-sm"
          onClick={() => setIsLearnMoreOpen(false)}
        >
          <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
            <div
              className="w-full max-w-4xl rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(245,249,231,0.98))] p-6 shadow-[0_36px_120px_rgba(14,23,38,0.24)] sm:p-8"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/46">
                    Learn more
                  </p>
                  <h3 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-ink">
                    What Zik App and Zik Pass actually do
                  </h3>
                </div>
                <button
                  aria-label="Close learn more"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white text-xl text-ink hover:bg-[#f4f7ee]"
                  onClick={() => setIsLearnMoreOpen(false)}
                >
                  ×
                </button>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <InfoBlock
                  title="What is Zik App?"
                  body={
                    isPhysicalLane
                      ? "Zik App starts a fresh in-store session, creates the holder key on this device, and receives the staff-confirmed 18+ result after the physical ID check."
                      : "Zik App is the onboarding experience that helps a new user get set up. It collects a few matching details, guides the refundable bank step, and stores the pass on this device."
                  }
                />
                <InfoBlock
                  title="What is Zik Pass?"
                  body={
                    isPhysicalLane
                      ? "ZikPass is the signed Over-18 credential issued to this device after an authorised in-person age check."
                      : "Zik Pass is the secure Over-18 credential created at the end of that process. Sites can verify it locally without learning your identity."
                  }
                />
                <InfoBlock
                  title={isPhysicalLane ? "Why staff check ID" : "Why the bank step exists"}
                  body={
                    isPhysicalLane
                      ? "The physical ID is evidence for the human verifier. Zik only needs the authorised result that the customer was confirmed 18+."
                      : "The refundable GBP 0.01 reference helps confirm control of a real adult-linked financial account. It is temporary and used only as a verification signal."
                  }
                />
                <InfoBlock
                  title={isPhysicalLane ? "What Zik does not store" : "Why there is a short wait"}
                  body={
                    isPhysicalLane
                      ? "Zik does not store a copy of the physical ID, an ID image, name, date of birth, address, or ID number for this physical flow."
                      : "The activation window gives you time to spot anything unexpected before the pass can be used. It is a safety feature, not a delay for delay’s sake."
                  }
                />
              </div>

              <div className="mt-6 rounded-[28px] bg-[#0f1721] p-6 text-mist">
                <div className="grid gap-4 md:grid-cols-3">
                  {isPhysicalLane ? (
                    <>
                      <HeroMetric label="ID handling" value="Checked in person" />
                      <HeroMetric label="Zik stores" value="18+ attestation" />
                      <HeroMetric label="Wallet" value="In-person verified" />
                    </>
                  ) : (
                    <>
                      <HeroMetric label="No ID upload" value="No passport or selfie" />
                      <HeroMetric label="Soft check" value="Does not affect score" />
                      <HeroMetric label="What sites see" value="Over-18 confirmation" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AffiliateStoreSelector({
  selectedStoreId,
  onSelect
}: {
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div
        className="relative min-h-[220px] overflow-hidden rounded-[24px] border border-ink/8 bg-[#dfe8d3]"
        style={{
          backgroundImage:
            "linear-gradient(28deg, transparent 46%, rgba(255,255,255,0.74) 47%, rgba(255,255,255,0.74) 50%, transparent 51%), linear-gradient(112deg, transparent 44%, rgba(255,255,255,0.58) 45%, rgba(255,255,255,0.58) 48%, transparent 49%), linear-gradient(180deg, rgba(215,241,113,0.35), transparent 62%)"
        }}
      >
        <p className="absolute left-4 top-4 rounded-full bg-white/75 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Affiliate locations
        </p>
        {affiliateStores.map((store) => {
          const isSelected = store.id === selectedStoreId;

          return (
            <button
              key={store.id}
              aria-label={`Select ${store.name}`}
              aria-pressed={isSelected}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 p-1 shadow-[0_8px_18px_rgba(14,23,38,0.16)] transition-transform hover:scale-110 ${
                isSelected ? "border-ink bg-lime" : "border-white bg-ink"
              }`}
              onClick={() => onSelect(store.id)}
              style={store.mapPosition}
              type="button"
            >
              <span className="block h-4 w-4 rounded-full bg-current" />
            </button>
          );
        })}
      </div>

      <div className="grid content-start gap-2">
        {affiliateStores.map((store) => {
          const isSelected = store.id === selectedStoreId;

          return (
            <button
              key={store.id}
              aria-pressed={isSelected}
              className={`rounded-[18px] border p-3 text-left transition ${
                isSelected
                  ? "border-ink bg-ink text-mist"
                  : "border-ink/8 bg-white/75 text-ink hover:bg-white"
              }`}
              onClick={() => onSelect(store.id)}
              type="button"
            >
              <span className="block text-sm font-semibold">{store.name}</span>
              <span className={isSelected ? "mt-1 block text-xs text-mist/70" : "mt-1 block text-xs text-ink/55"}>
                {store.area} · {store.address}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WalletStatusFooter({
  canDeleteLocalPass,
  deleteButtonState,
  isOpen,
  onReset,
  onToggle,
  status,
  statusMeta
}: {
  canDeleteLocalPass: boolean;
  deleteButtonState: "idle" | "deleted";
  isOpen: boolean;
  onReset: () => void;
  onToggle: () => void;
  status: ReturnType<typeof getWalletStatusSnapshot>;
  statusMeta: Array<{ label: string; value: string }>;
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

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-end px-3 pb-10 transition-[height] duration-200 sm:px-6 lg:px-8 ${isOpen ? "h-44" : "h-24"}`}
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,0.31) 0%, rgba(255,255,255,1) 50%, rgba(162,206,106,1) 100%)",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%"
      }}
    >
      <section
        aria-live="polite"
        className="pointer-events-auto mx-auto w-[85%] max-w-[1088px] rounded-[22px] bg-white/80 p-1.5 opacity-25 shadow-[0_-12px_36px_rgba(14,23,38,0.08)] transition-[opacity,background-image,background-color] duration-200 hover:bg-[linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(244,247,238,0.94))] hover:opacity-100 sm:p-2"
      >
        <div className="flex flex-wrap items-center gap-2 px-1 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink/45">Your status</p>
            <StatusPill tone={statusLabel === "Active" ? "good" : statusLabel === "Expired" ? "warn" : "neutral"}>
              {statusLabel}
            </StatusPill>
            {canDeleteLocalPass || deleteButtonState === "deleted" ? (
              <button
                className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-mist disabled:opacity-55"
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
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink/10 bg-white text-sm font-semibold text-ink hover:bg-[#edf3df]"
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
              <div className={item.label === "Flow" ? "hidden sm:block" : ""} key={item.label}>
                <MetaTile label={item.label} value={item.value} />
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PhysicalOnboardingExperience({
  credential,
  deviceAuthMethod,
  deviceAuthSummary,
  enrollment,
  error,
  isPending,
  physicalSession,
  step,
  remainingSeconds,
  coolingProgress,
  issuedZignatureSeed,
  pendingZignatureSeed,
  onAuthenticateDevice,
  onReset
}: {
  credential: WalletState["credential"];
  deviceAuthMethod: "webauthn" | "demo_device_check";
  deviceAuthSummary: string | null;
  enrollment: EnrollmentRecord | null;
  error: string | null;
  isPending: boolean;
  physicalSession: PhysicalStoreSessionRecord | null;
  step: FlowStep;
  remainingSeconds: number;
  coolingProgress: number;
  issuedZignatureSeed: string | null;
  pendingZignatureSeed: string | null;
  onAuthenticateDevice: () => void;
  onReset: () => void;
}) {
  const verification = enrollment?.physical_verification;
  const [browserOrigin, setBrowserOrigin] = useState("");
  const storeName =
    verification?.session.store_name ?? physicalSession?.store_name ?? "this store";
  const sessionCode = verification?.user_code.value;
  const processState = getPhysicalProcessState({
    credentialIssued: Boolean(credential),
    enrollment,
    session: physicalSession,
    hasSessionStarted: Boolean(physicalSession)
  });
  const challengeUrl = verification && sessionCode
    ? buildRetailVerificationScanUrl({
        userCode: sessionCode,
        sessionId: verification.session.session_id
      })
    : null;
  const challengeValue =
    challengeUrl && browserOrigin
      ? `${browserOrigin}${challengeUrl}`
      : challengeUrl ?? `zikpass:physical:preparing:${physicalSession?.session_id ?? "new"}`;

  useEffect(() => {
    setBrowserOrigin(window.location.origin);
  }, []);

  if (processState === "expired") {
    return (
      <PhysicalStageFrame
        accent="bg-[#d27a86]"
        progress={24}
        title="This code has expired"
        body="Scan the Zik card again to restart."
      >
        <div className="zik-stage-pop grid place-items-center gap-7">
          <div className="grid h-36 w-36 place-items-center rounded-full border-[10px] border-[#d27a86]/35 text-7xl font-semibold text-[#b24f61]">
            !
          </div>
          <button
            className="rounded-full bg-ink px-7 py-4 text-base font-semibold text-mist"
            onClick={onReset}
            type="button"
          >
            Start again
          </button>
        </div>
      </PhysicalStageFrame>
    );
  }

  if (processState === "rejected" || step === "rejected") {
    return (
      <PhysicalStageFrame
        accent="bg-[#df8291]"
        progress={32}
        title="We couldn't verify your age"
        body={error ?? enrollment?.last_user_message ?? "Ask the staff member for help or try again."}
      >
        <div className="zik-stage-pop grid place-items-center gap-7">
          <div className="grid h-36 w-36 place-items-center rounded-full border-[10px] border-[#df8291]/35 text-7xl font-semibold text-[#b24f61]">
            !
          </div>
          <button
            className="rounded-full bg-ink px-7 py-4 text-base font-semibold text-mist"
            onClick={onReset}
            type="button"
          >
            Start again
          </button>
        </div>
      </PhysicalStageFrame>
    );
  }

  if (processState === "credential_issued" && credential) {
    return (
      <PhysicalStageFrame
        accent="bg-ink"
        progress={100}
        title="ZikPass ready"
        body="Your in-person verified pass has been delivered to this device."
      >
        <div className="zik-stage-pop grid w-full max-w-xl gap-7">
          <div className="rounded-[30px] border border-ink/8 bg-[#f7faee] p-5 text-ink ring-1 ring-ink/4">
            <p className="font-mono text-xs uppercase text-ink/48">Over 18</p>
            <p className="mt-2 font-heading text-5xl font-semibold">In-person verified</p>
            <Zignature
              animate
              className="mt-6 h-24 w-full"
              seedInput={issuedZignatureSeed ?? credential.payload.credential_id}
              stroke="#86a92a"
              strokeWidth={3.2}
              variant="full"
              width={340}
              height={100}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <PwaInstallButton
              className="rounded-full bg-ink px-7 py-4 text-center text-base font-semibold text-mist"
              label="Install ZikPass"
            />
            <Link
              className="rounded-full border border-ink/15 px-7 py-4 text-center text-base font-semibold text-ink"
              href="/wallet"
            >
              Open wallet
            </Link>
          </div>
        </div>
      </PhysicalStageFrame>
    );
  }

  if (processState === "verified" && verification) {
    const appHref = buildZikAppDeepLink({
      enrollmentId: enrollment?.id
    });

    return (
      <PhysicalStageFrame
        accent="bg-[#69b889]"
        progress={78}
        title="You're verified."
        body="Your ZikPass is ready to be secured on this device."
      >
        <div className="zik-stage-pop grid w-full max-w-md place-items-center gap-6 text-center">
          <div className="relative grid h-44 w-44 place-items-center rounded-full border border-[#69b889]/35 bg-[#f7faee]">
            <div className="absolute h-28 w-28 animate-ping rounded-full bg-lime/35" />
            <div className="grid h-28 w-28 place-items-center rounded-full bg-lime text-6xl font-semibold text-ink">
              ✓
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink/68">
              {deviceAuthMethod === "webauthn" ? "Face ID, fingerprint, or passcode" : "Device check ready"}
            </p>
            {deviceAuthSummary ? (
              <p className="mt-2 text-sm text-ink/72">{deviceAuthSummary}</p>
            ) : null}
          </div>
          <div className="grid w-full gap-3">
            <a
              className="rounded-full border border-ink/15 px-7 py-4 text-center text-base font-semibold text-ink"
              href={appHref}
            >
              Open Zik
            </a>
            <button
              className="rounded-full bg-ink px-7 py-4 text-base font-semibold text-mist disabled:opacity-55"
              disabled={isPending}
              onClick={onAuthenticateDevice}
              type="button"
            >
              {isPending ? "Securing..." : "Get Zik"}
            </button>
          </div>
        </div>
      </PhysicalStageFrame>
    );
  }

  if (processState === "app_handoff" || step === "cooling") {
    return (
      <PhysicalStageFrame
        accent="bg-[#69c5c3]"
        progress={92}
        title={remainingSeconds > 0 ? "Adding your pass" : "Issuing your pass"}
        body={
          remainingSeconds > 0
            ? `This finishes in ${remainingSeconds}s.`
            : "Zik is signing the credential for this device."
        }
      >
        <div className="zik-stage-pop grid w-full max-w-xl gap-7">
          <div className="grid place-items-center">
            <div className="h-24 w-24 animate-spin rounded-full border-[10px] border-ink/10 border-t-lime" />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-lime transition-[width] duration-700"
              style={{ width: `${Math.max(coolingProgress, 68)}%` }}
            />
          </div>
          <Zignature
            className="h-20 w-full opacity-80"
            seedInput={pendingZignatureSeed ?? enrollment?.id ?? "physical-pending"}
            stroke="#86a92a"
            strokeWidth={3}
            variant="compact"
            width={260}
            height={80}
          />
        </div>
      </PhysicalStageFrame>
    );
  }

  if (processState === "awaiting_retail_verification" && verification && sessionCode) {
    return (
      <PhysicalStageFrame
        accent="bg-[#69b889]"
        progress={56}
        title="Present your ID"
        body={`Show this screen and your physical ID to staff at ${storeName}.`}
      >
        <div className="zik-stage-pop grid w-full max-w-[520px] place-items-center gap-5">
          <a
            aria-label="Open retailer verification screen for this temporary customer QR"
            className="block w-full"
            href={challengeUrl ?? "/verify"}
          >
            <PhysicalChallengeQr value={challengeValue} />
          </a>
          <p className="font-heading text-6xl font-semibold tracking-[0.18em] text-ink sm:text-7xl">
            {sessionCode}
          </p>
          <p className="max-w-sm text-center text-sm font-semibold text-ink/64">
            Waiting for the clerk to confirm 18+
          </p>
        </div>
      </PhysicalStageFrame>
    );
  }

  return (
    <PhysicalStageFrame
      accent="bg-lime"
      progress={18}
      title="Preparing your challenge"
      body={error ? "Still working. Keep this page open while we reconnect." : "Creating a secure one-time verification session."}
    >
      <div className="zik-stage-pop grid place-items-center gap-8">
        <div className="relative grid h-44 w-44 place-items-center rounded-full border-[12px] border-ink/12">
          <div className="absolute h-32 w-32 animate-ping rounded-full bg-ink/10" />
          <div className="h-24 w-24 animate-spin rounded-full border-[10px] border-ink/14 border-t-ink" />
        </div>
        {error ? <p className="max-w-sm text-center text-sm font-semibold text-[#8B1D36]">{error}</p> : null}
      </div>
    </PhysicalStageFrame>
  );
}

function PhysicalStageFrame({
  accent,
  title,
  body,
  progress,
  children
}: {
  accent: string;
  title: string;
  body: string;
  progress: number;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.28),_transparent_42%),_#f4f7ee] px-4 py-5 text-ink sm:px-6 sm:py-7">
      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col overflow-hidden rounded-[40px] border border-white/80 bg-white/76 px-5 py-7 shadow-panel backdrop-blur-sm sm:min-h-[calc(100vh-3.5rem)] sm:px-8">
        <div className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />
        <p className="hidden text-center text-sm font-semibold text-ink/45 lg:block">Continue on your phone</p>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 text-center">
          <div className="zik-stage-copy">
            <h1 className="font-heading text-6xl font-semibold leading-[0.9] text-ink sm:text-8xl">{title}</h1>
            <p className="mx-auto mt-5 max-w-xl text-lg font-semibold text-ink/68">{body}</p>
          </div>
          {children}
        </div>

        <div className="mx-auto w-full max-w-3xl">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${accent}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function PhysicalChallengeQr({ value }: { value: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void QRCode.toDataURL(value, {
      color: {
        dark: "#0E1726",
        light: "#FFFFFF"
      },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 430
    }).then((nextDataUrl) => {
      if (active) {
        setQrDataUrl(nextDataUrl);
      }
    });

    return () => {
      active = false;
    };
  }, [value]);

  return (
    <div
      aria-label="Temporary customer verification QR"
      className="grid w-full max-w-[430px] place-items-center rounded-[34px] bg-white p-5 shadow-[0_28px_90px_rgba(0,0,0,0.22)]"
    >
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Temporary customer verification QR"
          className="h-auto w-full rounded-[18px]"
          src={qrDataUrl}
        />
      ) : (
        <div className="h-[320px] w-full animate-pulse rounded-[18px] bg-ink/10" />
      )}
    </div>
  );
}

function JourneyTracker({
  lane,
  state
}: {
  lane: "remote" | "physical";
  state: JourneyState;
}) {
  const steps = lane === "physical"
    ? [
        {
          label: "Store",
          body: "Session detected",
          states: ["physical_session_detected"] as JourneyState[]
        },
        {
          label: "Device",
          body: "Create local key",
          states: ["collecting_details", "submitting"] as JourneyState[]
        },
        {
          label: "Staff",
          body: "Show QR and ID",
          states: ["awaiting_clerk_verification"] as JourneyState[]
        },
        {
          label: "Issue",
          body: "Authenticate here",
          states: ["device_auth_required", "physical_verification_complete", "pass_issued"] as JourneyState[]
        }
      ]
    : [
        {
          label: "Details",
          body: "Match your record",
          states: ["collecting_details", "submitting"] as JourneyState[]
        },
        {
          label: "Bank",
          body: "Confirm GBP 0.01",
          states: ["bank_verification_pending", "bank_verification_confirming"] as JourneyState[]
        },
        {
          label: "Activation",
          body: "Protect, then use",
          states: ["cooling_off_pending", "activation_ready", "pass_issued"] as JourneyState[]
        }
      ];

  const activeIndex = steps.findIndex((step) => step.states.includes(state));

  return (
    <div className="rounded-[22px] border border-[#c6e29e]/55 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(237,247,219,0.96))] px-2.5 py-2.5 sm:rounded-[28px] sm:px-4 sm:py-4">
      <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 sm:hidden">
        {steps.map((step, index) => {
          const complete = activeIndex > index || state === "pass_issued";
          const active = activeIndex === index;

          return (
            <div
              key={step.label}
              className={`min-w-[118px] shrink-0 rounded-[16px] px-2.5 py-2 ${
                complete
                  ? "bg-[linear-gradient(135deg,_#7cb56b,_#a2ce6a)] text-ink shadow-[0_10px_24px_rgba(124,181,107,0.22)]"
                  : active
                    ? "bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(226,244,194,0.98))] text-ink ring-1 ring-[#a2ce6a]/70"
                    : "bg-[#eef6df] text-ink/68"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    complete
                      ? "bg-ink/90 text-mist"
                      : active
                        ? "bg-ink text-mist"
                        : "bg-white/80 text-ink/60"
                  }`}
                >
                  {complete ? "✓" : index + 1}
                </span>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]">{step.label}</p>
              </div>
              <p className="mt-1.5 text-[11px] leading-4">{step.body}</p>
            </div>
          );
        })}
      </div>
      <div className={`hidden sm:grid sm:gap-3 ${lane === "physical" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {steps.map((step, index) => {
          const complete = activeIndex > index || state === "pass_issued";
          const active = activeIndex === index;

          return (
            <div
              key={step.label}
              className={`rounded-[22px] px-4 py-3 ${
                complete
                  ? "bg-[linear-gradient(135deg,_#7cb56b,_#a2ce6a)] text-ink shadow-[0_14px_32px_rgba(124,181,107,0.24)]"
                  : active
                    ? "bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(226,244,194,0.98))] text-ink ring-1 ring-[#a2ce6a]/70"
                    : "bg-[#eef6df] text-ink/68"
              }`}
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.22em]">{step.label}</p>
              <p className="mt-2 text-sm leading-5">{step.body}</p>
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
  error,
  nextLabel = "Next",
  onBack,
  onNext
}: {
  step: string;
  title: string;
  body?: string;
  children: ReactNode;
  canContinue: boolean;
  error?: string | null;
  nextLabel?: string;
  onBack?: () => void;
  onNext: () => void;
}) {
  return (
    <div className="grid min-h-[60vh] overflow-hidden rounded-[28px] border border-ink/8 bg-transparent sm:min-h-[68vh] sm:rounded-[34px]">
      <div className="flex flex-col justify-between p-4 sm:p-8">
        <div className="space-y-4 sm:space-y-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45 sm:text-xs sm:tracking-[0.24em]">
            {step}
          </p>
          <div className="space-y-2 sm:space-y-3">
            <h3 className="font-heading text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
              {title}
            </h3>
            {body ? (
              <p className="max-w-2xl text-sm leading-6 text-ink/70 sm:text-base sm:leading-7">{body}</p>
            ) : null}
            {error ? (
              <p className="max-w-2xl text-sm leading-6 text-[#b4535f]">{error}</p>
            ) : null}
          </div>
          <div>{children}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
          {onBack ? (
            <button
              className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-medium text-ink"
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
  onAction,
  actionClassName,
  actionAside = false,
  showPassPreview = false,
  passPreviewEmphasis = false
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
  actionLabel?: string;
  actionHref?: Route;
  onAction?: () => void;
  actionClassName?: string;
  actionAside?: boolean;
  showPassPreview?: boolean;
  passPreviewEmphasis?: boolean;
}) {
  const renderActionAside = actionAside && Boolean(actionLabel);

  return (
    <div
      className={`grid min-h-[68vh] min-w-0 w-full max-w-full overflow-hidden rounded-[34px] border border-ink/8 bg-transparent ${
        showPassPreview ? "lg:grid-cols-[1.12fr_0.88fr]" : ""
      }`}
    >
      <div className="flex min-w-0 flex-col justify-between p-4 sm:p-8">
        <div className="space-y-5">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/45">{eyebrow}</p>
          <div className="space-y-3">
            <h3 className="break-words font-heading text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {title}
            </h3>
            <p className="max-w-2xl break-words text-sm leading-7 text-ink/70 sm:text-base">{body}</p>
          </div>
          {children}
        </div>

        {!renderActionAside && actionHref ? (
          <Link
            className={`mt-8 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist ${
              actionClassName ?? "w-fit"
            }`}
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : !renderActionAside && actionLabel ? (
          <button
            className={`mt-8 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist ${
              actionClassName ?? "w-fit"
            }`}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      {showPassPreview ? (
        renderActionAside ? (
          <aside className="relative flex min-w-0 w-full items-center justify-center border-t border-ink/10 p-4 sm:p-8 lg:border-l lg:border-t-0">
            {actionHref ? (
              <Link
                className={`inline-flex h-[150px] w-full max-w-[400px] items-center justify-center rounded-full px-5 py-4 text-center font-semibold sm:px-8 ${
                  actionClassName ?? "w-full max-w-xs justify-center"
                }`}
                href={actionHref}
              >
                {actionLabel}
              </Link>
            ) : (
              <button
                className={`inline-flex h-[150px] w-full max-w-[400px] items-center justify-center rounded-full px-5 py-4 text-center font-semibold sm:px-8 ${
                  actionClassName ?? "w-full max-w-xs justify-center"
                }`}
                onClick={onAction}
              >
                {actionLabel}
              </button>
            )}
          </aside>
        ) : (
          <WalletFlowAside emphasis={passPreviewEmphasis} />
        )
      ) : null}
    </div>
  );
}

function IdentityCheckIntro({
  compact = false,
  lane = "remote"
}: {
  compact?: boolean;
  lane?: "remote" | "physical";
}) {
  return (
    <div className={`mb-6 rounded-[28px] bg-ink/5 px-5 py-3.5 text-ink/78 ${compact ? "mt-4" : ""}`}>
      <p className="font-heading text-xl font-semibold tracking-tight text-ink">
        {lane === "physical" ? "Prepare your in-store verification" : "Help us find your financial record"}
      </p>
      <p className="mt-1.5 text-sm leading-6">
        {lane === "physical"
          ? "These details support the ID check staff will complete in store."
          : "We use this to securely check for signs of adult financial activity."}
      </p>
      <div className="mt-3 space-y-1.5 text-sm text-ink/68">
        {lane === "physical" ? (
          <>
            <p>Staff will verify your ID in person before the pass is issued.</p>
            <p>This device must complete device authentication before the pass can be delivered.</p>
          </>
        ) : (
          <>
            <p>This is a soft check and won&apos;t affect your credit score.</p>
            <p>We don&apos;t see your transactions or store your personal data after this step.</p>
          </>
        )}
      </div>
    </div>
  );
}

function PhysicalVerificationPanel({
  enrollment,
  physicalSession
}: {
  enrollment: EnrollmentRecord;
  physicalSession: PhysicalStoreSessionRecord | null;
}) {
  const verification = enrollment.physical_verification;

  if (!verification) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[28px] bg-ink p-5 text-mist">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="good">{verification.session.store_name}</StatusPill>
          <StatusPill tone="neutral">
            {verification.clerk_verification.status === "verified" ? "ID check confirmed" : "Awaiting staff"}
          </StatusPill>
        </div>
        <CustomerSessionQr
          value={`zikpass:physical:${verification.session.session_id}:${verification.user_code.value}`}
        />
        <p className="mt-5 text-center font-heading text-5xl font-semibold tracking-[0.18em]">
          {verification.user_code.value}
        </p>
        <p className="mt-3 text-sm leading-6 text-mist/76">
          This short-lived QR/code identifies only this verification session. It does not contain
          your name, date of birth, address, ID number, or ID image.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <BankMetaTile label="Session" value={verification.session.session_id} />
          <BankMetaTile label="Location" value={verification.session.location_id} />
          <BankMetaTile
            label="Expires"
            value={formatDateLabel(verification.user_code.expires_at, "Unavailable")}
          />
        </div>
      </div>

                      <div className="rounded-[28px] bg-white p-5 text-sm text-ink/76">
        <div className="space-y-3">
          <InstructionRow number="1" body="Show this code to the staff member assisting you." />
          <InstructionRow number="2" body="When prompted, show your ID." />
          <InstructionRow
            number="3"
            body="Complete device authentication in person for stronger proof."
          />
        </div>
        <div className="mt-5 rounded-[20px] bg-ink/5 px-4 py-3 text-sm text-ink/72">
          {physicalSession?.status === "awaiting_device_auth" ||
          verification.clerk_verification.status === "verified"
            ? "ID check confirmed. Device authentication is next."
            : enrollment.last_user_message ?? "Waiting for store staff to confirm the in-person ID check."}
                        </div>
                      </div>
                      <PwaInstallButton
                        className="w-full rounded-[22px] border border-ink/12 bg-[#f7faee] px-5 py-4 text-left text-sm font-semibold text-ink transition hover:bg-[#edf3df] sm:w-fit"
                        enrollmentId={enrollment?.id}
                        label="Install ZikPass on this device"
                      />
                    </div>
  );
}

function CustomerSessionQr({ value }: { value: string }) {
  const size = 13;
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const column = index % size;
    const finder =
      (row < 4 && column < 4) ||
      (row < 4 && column >= size - 4) ||
      (row >= size - 4 && column < 4);

    if (finder) {
      return row === 0 ||
        column === 0 ||
        row === size - 1 ||
        column === size - 1 ||
        row === 3 ||
        column === 3 ||
        row === size - 4 ||
        column === size - 4;
    }

    const charCode = value.charCodeAt(index % value.length);
    return ((charCode + row * 17 + column * 31 + index) % 5) < 2;
  });

  return (
    <div
      aria-label="Temporary customer verification QR"
      className="mx-auto mt-6 grid w-full max-w-[260px] grid-cols-[repeat(13,minmax(0,1fr))] gap-1 rounded-[24px] bg-white p-4"
    >
      {cells.map((filled, index) => (
        <span
          key={index}
          className={`aspect-square rounded-[3px] ${filled ? "bg-ink" : "bg-[#edf6d7]"}`}
        />
      ))}
    </div>
  );
}

function BankVerificationPanel({ enrollment }: { enrollment: EnrollmentRecord }) {
  const bankStatusLabel =
    enrollment.bank_verification.transaction_status === "confirmed"
      ? "Confirmed"
      : enrollment.bank_verification.transaction_status === "provider_unavailable" ||
          enrollment.bank_verification.transaction_status === "timeout"
        ? "Provider issue"
        : enrollment.bank_verification.transaction_status === "failed"
          ? "Failed"
          : "Sent";

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[28px] bg-ink p-5 text-mist">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="good">{enrollment.bank_verification.bank_name}</StatusPill>
          <StatusPill
            tone={
              enrollment.bank_verification.transaction_status === "confirmed"
                ? "good"
                : enrollment.bank_verification.transaction_status === "failed"
                  ? "warn"
                  : "neutral"
            }
          >
            {bankStatusLabel}
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
        <p className="mt-3 text-xs text-mist/68">
          Attempts {enrollment.bank_verification.attempts} of {enrollment.bank_verification.max_attempts}
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
        {enrollment.last_user_message ? (
          <p className="mt-5 rounded-[20px] bg-ink/5 px-4 py-3 text-sm text-ink/72">
            {enrollment.last_user_message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PassPreviewCard({
  credentialId,
  active,
  zignatureSeedInput
}: {
  credentialId: string;
  active: boolean;
  zignatureSeedInput: string;
}) {
  return (
    <div className="relative min-w-0 w-full max-w-full overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,_#243818_0%,_#557f33_48%,_#a2ce6a_100%)] p-4 text-mist sm:p-6">
      <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-[#e9f8c9]/20 blur-3xl" />
      <div className="relative min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#edf9d1]">Zik Pass</p>
            <p className="mt-2 font-heading text-3xl font-semibold tracking-tight">Over 18</p>
          </div>
          <StatusPill tone={active ? "good" : "neutral"}>{active ? "Active" : "Activating"}</StatusPill>
        </div>
        <div className="mt-7 min-w-0 rounded-[26px] border border-white/12 bg-white/8 px-3 py-4 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#edf9d1]/72">
                Your Zignature
              </p>
              <p className="mt-1 text-sm text-mist/78">Unique to this pass</p>
            </div>
            <p className="break-words text-right font-mono text-[11px] uppercase tracking-[0.18em] text-[#edf9d1]/55">
              Deterministic mark
            </p>
          </div>
          <Zignature
            animate={active}
            className="mt-3 h-20 w-full"
            seedInput={zignatureSeedInput}
            stroke="#eef9c7"
            strokeWidth={3.2}
            variant="full"
            width={320}
            height={96}
          />
        </div>
        <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-3">
          <BankMetaTile label="Pass ID" value={credentialId} />
          <BankMetaTile label="Identity shared" value="No" />
          <BankMetaTile label="Bound to device" value="Yes" />
        </div>
      </div>
    </div>
  );
}

function CredentialVisualPreview({
  title,
  body,
  seedInput,
  variant = "full",
  muted = false
}: {
  title: string;
  body: string;
  seedInput: string;
  variant?: "full" | "compact";
  muted?: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-ink/10 bg-white/88 p-5 shadow-[0_18px_40px_rgba(14,23,38,0.08)]">
      <div className="rounded-[24px] bg-[#f7faee] p-5">
        <div className="rounded-[22px] border border-ink/8 bg-white/75 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/46">
              Your Zignature
            </p>
            <p className="text-xs text-ink/52">
              {muted ? "Preview before signing" : "Unique to this pass"}
            </p>
          </div>
          <Zignature
            className="mt-3 h-20 w-full"
            seedInput={seedInput}
            stroke={muted ? "#7f9363" : "#86a92a"}
            strokeWidth={variant === "compact" ? 2.9 : 3.1}
            variant={variant}
            width={variant === "compact" ? 220 : 320}
            height={variant === "compact" ? 72 : 96}
          />
        </div>
      </div>
      <p className="mt-6 font-heading text-2xl font-semibold tracking-tight text-ink">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-7 text-ink/72">{body}</p>
    </div>
  );
}

function WalletFlowAside({ emphasis = false }: { emphasis?: boolean }) {
  return (
    <aside className="relative hidden overflow-hidden border-l border-ink/10 bg-transparent lg:flex lg:flex-col lg:justify-between lg:p-8">
      <section className="relative my-auto rounded-[32px] border border-ink/10 bg-white/88 p-6 text-ink shadow-[0_22px_60px_rgba(14,23,38,0.14)] backdrop-blur-sm">
        <div className="inline-flex items-center rounded-full border border-ink/10 bg-[#eef6df] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/68">
          {emphasis ? "Signed preview" : "Credential preview"}
        </div>
        <div className="mt-5">
          <CredentialVisualPreview
            title="Your pass"
            body="This preview represents the signed ZikPass credential that will be available on this device after activation. The final Zignature is deterministic for the credential."
            seedInput="wallet-preview"
            muted
          />
        </div>
      </section>
    </aside>
  );
}

function HeroMetric({
  label,
  value,
  dark = false
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div>
      <p
        className={`font-mono text-[11px] uppercase tracking-[0.22em] ${
          dark ? "text-ink/42" : "text-mist/48"
        }`}
      >
        {label}
      </p>
      <p className={`mt-2 text-sm font-medium ${dark ? "text-ink" : "text-mist"}`}>{value}</p>
    </div>
  );
}

function HeroSlidePill({
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
      className={`rounded-full px-3 py-1 shadow-sm transition ${
        active
          ? "bg-[#e9f6d0] text-ink"
          : "border border-ink/10 bg-white/78 text-ink/70 hover:bg-[#f3f8e6]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function HeroViewTab({
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
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? "bg-[#DDF0EC] text-ink" : "bg-ink/8 text-ink/80 hover:bg-ink/12"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function HowItWorksGraphic({
  art
}: {
  art:
    | (typeof howZikPassWorksSlides)[number]["art"]
    | (typeof physicalHowZikPassWorksSlides)[number]["art"];
}) {
  if (art === "physical-session") {
    return (
      <div className="rounded-[26px] bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f8e6_100%)] p-5">
        <div className="grid gap-3">
          <WorkflowStage label="1" title="Generic card" body="One printed QR can start many fresh sessions." />
          <WorkflowStage label="2" title="New session" body="Zik creates a short-lived opaque session." />
          <WorkflowStage label="3" title="Customer QR" body="The phone displays a temporary code for staff." />
        </div>
      </div>
    );
  }

  if (art === "staff-check") {
    return (
      <div className="rounded-[26px] bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f8e6_100%)] p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineDetail title="Staff sees" body="The customer and their physical ID." />
          <InlineDetail title="Zik receives" body="An authorised 18+ attestation." />
          <InlineDetail title="Zik does not receive" body="ID image, DOB, address, or ID number." />
        </div>
      </div>
    );
  }

  if (art === "physical-pass") {
    return (
      <div className="rounded-[26px] bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f8e6_100%)] p-5">
        <div className="space-y-4">
          <div className="rounded-[22px] border border-ink/8 bg-white p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/42">Wallet shows</p>
            <p className="mt-2 font-heading text-2xl font-semibold tracking-tight text-ink">
              18+ · In-person verified
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InlineDetail title="Signed by" body="Zik issuer key." />
            <InlineDetail title="Bound to" body="The holder public key on this device." />
          </div>
        </div>
      </div>
    );
  }

  if (art === "signals") {
    return (
      <div className="rounded-[26px] bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f8e6_100%)] p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <InlineDetail title="Soft check" body="Looks for adult financial signals only." />
          <InlineDetail title="Bank step" body="Refundable authorisation confirms control." />
          <InlineDetail title="No selfie" body="No biometric or photo upload required." />
        </div>
      </div>
    );
  }

  if (art === "signing") {
    return (
      <div className="rounded-[26px] bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f8e6_100%)] p-5">
        <div className="grid gap-3">
          <WorkflowStage label="1" title="Local key" body="Created on this device only." />
          <WorkflowStage label="2" title="Human review" body="Cooling off completes before signing." />
          <WorkflowStage label="3" title="Signed pass" body="Credential binds to the local holder key." />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[26px] bg-[linear-gradient(180deg,_#ffffff_0%,_#f3f8e6_100%)] p-5">
      <div className="space-y-4">
        <div className="rounded-[22px] border border-ink/8 bg-white p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/42">Site sees</p>
          <p className="mt-2 font-heading text-2xl font-semibold tracking-tight text-ink">Over 18</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InlineDetail title="Shared" body="Only the signed over-18 result." />
          <InlineDetail title="Hidden" body="Your identity, bank details, and address." />
        </div>
      </div>
    </div>
  );
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
          ? "border-lime/50 bg-[linear-gradient(135deg,_#111827,_#1d2a16)] text-mist shadow-[0_18px_50px_rgba(14,23,38,0.16)]"
          : "border-ink/10 bg-white text-ink hover:bg-[#f5f9e7]"
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
  invalid = false,
  onChange
}: {
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  placeholder?: string;
  value: string;
  className?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-invalid={invalid}
      className={`w-full rounded-[24px] border px-5 py-5 text-xl font-medium text-ink outline-none transition placeholder:text-ink/30 ${
        invalid
          ? "border-[#d27a86] bg-[#fff6f7] shadow-[0_0_0_1px_rgba(210,122,134,0.08)]"
          : "border-ink/10 bg-ink/5 focus:border-ink/20"
      } ${className}`}
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
    <div className="min-w-0 rounded-[20px] bg-white/75 px-4 py-4">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-2 break-words text-sm leading-6 text-ink/64">{body}</p>
    </div>
  );
}

function WorkflowStage({
  label,
  title,
  body
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] bg-white px-4 py-4">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DDF0EC] text-xs font-semibold text-ink">
        {label}
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-ink/64">{body}</p>
      </div>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[26px] border border-ink/8 bg-white/78 p-5">
      <p className="font-heading text-2xl font-semibold tracking-tight text-ink">{title}</p>
      <p className="mt-3 text-sm leading-7 text-ink/68">{body}</p>
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
    <div className="min-w-0 rounded-[18px] bg-white px-2.5 py-1.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/45">{label}</p>
      <p className="mt-0.5 break-words text-[11px] font-medium text-ink">{value}</p>
    </div>
  );
}

function BankMetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[22px] bg-white/8 px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-mist">{value}</p>
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

function formatDateLabel(value?: string, fallback = "Unavailable"): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}
