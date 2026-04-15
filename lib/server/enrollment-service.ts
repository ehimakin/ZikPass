import { runtimeConfig } from "@/lib/shared/config";
import type {
  ApplicationRiskDecision,
  BankVerificationNormalizedResponse,
  ProviderErrorShape,
  ProviderExecution
} from "@/lib/shared/provider-contracts";
import type {
  BankVerificationState,
  DuplicateApplicationState,
  EnrollmentApplicationInput,
  EnrollmentRecord,
  PhysicalDeviceAuthState,
  PhysicalStoreSessionRecord,
  PhysicalVerificationState
} from "@/lib/shared/types";
import { bytesToBase64Url, randomAlphaNumericCode, randomId, randomNumericCode } from "@/lib/shared/utils";
import { assertNoDuplicateApplication, checkDuplicateApplication } from "@/lib/server/application-guard";
import { issueCredential } from "@/lib/server/credential-issuer";
import { buildNotification } from "@/lib/server/notifications";
import {
  findPhysicalSessionByUserCode,
  getEnrollment,
  getPhysicalSession,
  listEnrollments,
  upsertEnrollment,
  upsertPhysicalSession
} from "@/lib/server/storage";
import {
  MockBankVerificationProvider
} from "@/lib/server/services/providers/bank-verification/provider";
import { MockCopProvider } from "@/lib/server/services/providers/cop/provider";
import {
  MockFinancialCheckProvider
} from "@/lib/server/services/providers/financial-check/provider";
import {
  buildProofFromProviderResults,
  createInitialOrchestration,
  evaluateDerivedProof,
  mapDecisionStateToEnrollmentStatus,
  pushOrchestrationEvent
} from "@/lib/server/services/orchestration/issuance-orchestrator";
import {
  DefaultApplicationRiskEngine
} from "@/lib/server/services/risk/application-risk-engine";

const financialCheckProvider = new MockFinancialCheckProvider();
const copProvider = new MockCopProvider();
const bankVerificationProvider = new MockBankVerificationProvider();
const riskEngine = new DefaultApplicationRiskEngine();

export async function startEnrollment(input: {
  application: EnrollmentApplicationInput;
  holderPublicKey: JsonWebKey;
  applicationFingerprint: string;
}): Promise<EnrollmentRecord> {
  if (input.application.lane === "physical" || input.application.physical_context) {
    return startPhysicalEnrollment(input);
  }

  const duplicateState = await assertNoDuplicateApplication(input.applicationFingerprint);
  const now = new Date().toISOString();
  const expectedCode = randomNumericCode(6);
  const record = createEnrollmentRecord({
    createdAt: now,
    application: input.application,
    holderPublicKey: input.holderPublicKey,
    applicationFingerprint: input.applicationFingerprint,
    duplicateState,
    expectedCode
  });

  const afterChecks = await runInitialProviderPipeline(record);
  return upsertEnrollment(afterChecks);
}

export async function retryEnrollmentProviders(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);
  if (record.lane === "physical") {
    throw new Error("In-person verification does not use the remote provider retry flow.");
  }
  const now = new Date().toISOString();

  record.notifications.unshift(
    buildNotification("We retried the external verification providers for this application.")
  );
  record.updated_at = now;
  record.last_retryable_error = undefined;

  const retried = await runInitialProviderPipeline(record, true);
  return upsertEnrollment(retried);
}

export async function verifyPossessionCode(
  enrollmentId: string,
  code: string
): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);
  if (record.lane === "physical") {
    throw new Error("In-person verification does not use bank possession codes.");
  }
  const now = new Date().toISOString();

  if (
    record.status === "declined_identity_mismatch" ||
    record.status === "declined_no_adult_signal" ||
    record.status === "declined_duplicate_application"
  ) {
    throw new Error("This application is no longer eligible for bank verification.");
  }

  record.bank_verification.attempts += 1;
  record.bank_verification.provider_execution.confirm.attempts += 1;
  record.bank_verification.provider_execution.confirm.requested_at = now;
  record.bank_verification.provider_execution.confirm.request = {
    application_id: record.id,
    verification_session_id: record.bank_verification.provider_session_id,
    expected_reference_code: record.bank_verification.code,
    user_entered_code: code.trim()
  };

  const confirmation = await bankVerificationProvider.confirmVerification({
    request: record.bank_verification.provider_execution.confirm.request,
    expected_code: record.bank_verification.code,
    provider_session_id: record.bank_verification.provider_session_id,
    scenario: record.provider_scenario,
    attempts: record.bank_verification.attempts
  });

  record.bank_verification.provider_execution.confirm.completed_at = new Date().toISOString();
  record.bank_verification.provider_execution.confirm.latency_ms = confirmation.latency_ms;
  record.bank_verification.provider_execution.confirm.raw_response = confirmation.raw_response;
  record.bank_verification.provider_execution.confirm.normalized_response =
    confirmation.normalized_response;
  record.updated_at = new Date().toISOString();

  if (confirmation.normalized_response.outcome === "code_confirmed") {
    record.bank_verification.transaction_status = "confirmed";
    record.bank_verification.confirmed_at = record.updated_at;
    record.bank_verification_completed_at = record.updated_at;
    record.last_user_message =
      "Bank verification confirmed. We are now checking final issuance readiness.";
    record.notifications.unshift(
      buildNotification(
        "Bank verification confirmed. The application moved into the risk and issuance stage."
      )
    );
    record.orchestration = pushOrchestrationEvent(
      record.orchestration,
      "bank_verification_completed",
      "Bank verification code confirmed by the provider.",
      record.updated_at
    );
    return persistAndFinalize(reevaluateEnrollment(record));
  }

  if (confirmation.normalized_response.outcome === "code_invalid") {
    record.bank_verification.transaction_status = "pending";
    record.last_retryable_error = createProviderError(
      "bank-verification-provider",
      "error",
      "The verification code did not match the provider record.",
      true,
      record.updated_at
    );
    record.last_user_message =
      "We could not confirm that code. Please try the reference again.";
    record.notifications.unshift(
      buildNotification("Bank verification code mismatch. A retry is still allowed.")
    );

    if (record.bank_verification.attempts >= record.bank_verification.max_attempts) {
      record.bank_verification.transaction_status = "failed";
      record.bank_verification.failed_at = record.updated_at;
      record.risk_decision = riskEngine.evaluate({
        duplicate_state: record.duplicate_state,
        financial_check: record.providers.financial_check.normalized_response,
        cop: record.providers.cop.normalized_response,
        bank_verification: confirmation.normalized_response
      });
      record.status = "declined_bank_control_failed";
      record.orchestration = pushOrchestrationEvent(
        record.orchestration,
        "declined",
        "Bank verification failed after repeated invalid codes.",
        record.updated_at
      );
    } else {
      record.status = "bank_verification_pending";
      record.orchestration = pushOrchestrationEvent(
        record.orchestration,
        "bank_verification_started",
        "Bank verification remains pending after an invalid code attempt.",
        record.updated_at
      );
    }

    return upsertEnrollment(record);
  }

  if (confirmation.normalized_response.outcome === "verification_failed") {
    record.bank_verification.transaction_status = "failed";
    record.bank_verification.failed_at = record.updated_at;
    record.last_user_message =
      "We could not confirm control of that bank account. Start again if you need a new attempt.";
    record.notifications.unshift(
      buildNotification("Bank verification failed after the provider rejected the confirmation.")
    );
    record.risk_decision = riskEngine.evaluate({
      duplicate_state: record.duplicate_state,
      financial_check: record.providers.financial_check.normalized_response,
      cop: record.providers.cop.normalized_response,
      bank_verification: confirmation.normalized_response
    });
    record.status = "declined_bank_control_failed";
    record.orchestration = pushOrchestrationEvent(
      record.orchestration,
      "declined",
      "Bank verification failed.",
      record.updated_at
    );
    return upsertEnrollment(record);
  }

  record.bank_verification.transaction_status =
    confirmation.normalized_response.outcome === "timeout" ? "timeout" : "provider_unavailable";
  record.last_retryable_error = createProviderError(
    "bank-verification-provider",
    confirmation.normalized_response.outcome === "timeout" ? "timeout" : "provider_unavailable",
    "Bank verification could not be completed right now.",
    true,
    record.updated_at
  );
  record.last_user_message = "We could not complete your bank verification right now. Please try again.";
  record.notifications.unshift(
    buildNotification("Bank verification provider returned a retryable operational failure.")
  );
  record.risk_decision = riskEngine.evaluate({
    duplicate_state: record.duplicate_state,
    financial_check: record.providers.financial_check.normalized_response,
    cop: record.providers.cop.normalized_response,
    bank_verification: confirmation.normalized_response
  });
  record.status = "retry_provider_failure";
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "retry_required",
    "Bank verification provider failed and the application can be retried.",
    record.updated_at
  );
  return upsertEnrollment(record);
}

export async function advanceCoolingOff(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);
  const now = new Date().toISOString();

  record.cooling_off.manually_advanced = true;
  record.cooling_off.ends_at = now;
  record.cooling_off.satisfied_at = now;
  record.updated_at = now;
  record.notifications.unshift(
    buildNotification("Cooling-off period was manually advanced in demo mode.")
  );
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "cooling_off_completed",
    "Cooling-off was manually advanced for local testing.",
    now
  );

  return persistAndFinalize(record);
}

export async function issueEnrollmentCredential(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);

  if (record.issued_credential) {
    return record;
  }

  if (!record.risk_decision.eligible_for_issuance) {
    throw new Error("This application is not yet eligible for credential issuance.");
  }

  if (record.lane === "remote" && record.bank_verification.transaction_status !== "confirmed") {
    throw new Error("Bank verification must complete before issuance.");
  }

  if (record.lane === "physical") {
    const session = await getLinkedPhysicalSession(record);
    if (session.clerk_verification.status !== "verified" || session.device_auth.status !== "verified") {
      throw new Error("In-person verification and device authentication must complete first.");
    }
  }

  if (!coolingOffSatisfied(record)) {
    throw new Error("Cooling-off must complete before the issuer can sign the credential.");
  }

  return signIssuedCredential(record);
}

export async function getEnrollmentOrThrow(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(enrollmentId);

  if (record.lane === "physical" && record.physical_verification) {
    const session = await getLinkedPhysicalSession(record);
    const synced = await syncPhysicalEnrollmentFromSession(record, session);

    if (!synced.issued_credential && coolingOffSatisfied(synced)) {
      return persistAndFinalize(synced);
    }

    return synced;
  }

  if (!record.issued_credential && coolingOffSatisfied(record)) {
    return persistAndFinalize(record);
  }

  return record;
}

export async function getIssuerSessions(): Promise<EnrollmentRecord[]> {
  const records = await listEnrollments();
  return Promise.all(records.map((record) => getEnrollmentOrThrow(record.id)));
}

export async function createPhysicalStoreSession(input?: {
  storeId?: string;
  storeName?: string;
  locationId?: string;
}): Promise<PhysicalStoreSessionRecord> {
  const now = new Date();
  const nowIso = now.toISOString();
  const session: PhysicalStoreSessionRecord = {
    session_id: randomId("store"),
    store_id: input?.storeId?.trim() || "zik-london-001",
    store_name: input?.storeName?.trim() || "Zik Oxford Street",
    location_id: input?.locationId?.trim() || "front-desk",
    created_at: nowIso,
    updated_at: nowIso,
    expires_at: new Date(
      now.getTime() + runtimeConfig.physicalSessionTtlSeconds * 1000
    ).toISOString(),
    status: "open",
    clerk_verification: {
      status: "pending"
    },
    device_auth: {
      status: "pending"
    }
  };

  return upsertPhysicalSession(session);
}

export async function getPhysicalStoreSessionOrThrow(
  sessionId: string
): Promise<PhysicalStoreSessionRecord> {
  const session = await getPhysicalSession(sessionId);

  if (!session) {
    throw new Error("Store session not found.");
  }

  if (isPhysicalSessionExpired(session) && session.status !== "completed") {
    session.status = "expired";
    session.updated_at = new Date().toISOString();
    await upsertPhysicalSession(session);
    throw new Error("This store session has expired. Ask staff to start a new one.");
  }

  return session;
}

export async function lookupPhysicalStoreSessionByCode(
  userCode: string
): Promise<PhysicalStoreSessionRecord> {
  const session = await findPhysicalSessionByUserCode(userCode.trim().toUpperCase());

  if (!session) {
    throw new Error("No in-store verification session matches that code.");
  }

  return getPhysicalStoreSessionOrThrow(session.session_id);
}

export async function verifyPhysicalIdCheck(input: {
  userCode: string;
  checkedBy?: string;
  note?: string;
}): Promise<EnrollmentRecord> {
  const session = await lookupPhysicalStoreSessionByCode(input.userCode);
  const record = await getPhysicalEnrollmentForSession(session);

  ensurePhysicalEnrollmentUsable(record, session);

  if (session.clerk_verification.status === "verified") {
    throw new Error("That session has already been confirmed by staff.");
  }

  const now = new Date().toISOString();
  session.clerk_verification = {
    status: "verified",
    checked_at: now,
    checked_by: input.checkedBy?.trim() || "Store staff",
    note: input.note?.trim() || "Physical ID checked in person."
  };
  session.status = session.device_auth.status === "verified" ? "ready_for_issuance" : "awaiting_device_auth";
  session.updated_at = now;

  record.physical_verification = toPhysicalVerificationState(session);
  record.updated_at = now;
  record.last_user_message =
    "ID check confirmed. Complete device authentication on this device to receive your pass.";
  record.status = session.device_auth.status === "verified" ? "approved_with_cooling_off" : "device_auth_pending";
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "in_person_verification_completed",
    "Store staff confirmed a physical ID check.",
    now
  );
  record.notifications.unshift(
    buildNotification("Store staff confirmed the in-person ID check for this session.")
  );

  await upsertPhysicalSession(session);
  return persistAndFinalize(record);
}

export async function startPhysicalDeviceAuth(
  enrollmentId: string
): Promise<{
  enrollment: EnrollmentRecord;
  challenge_id: string;
  challenge: string;
  expires_at: string;
}> {
  const record = await getExistingEnrollment(enrollmentId);
  const session = await getLinkedPhysicalSession(record);

  ensurePhysicalEnrollmentUsable(record, session);

  if (session.clerk_verification.status !== "verified") {
    throw new Error("Staff must confirm the in-person ID check before device authentication.");
  }

  if (session.device_auth.status === "verified") {
    const synced = await syncPhysicalEnrollmentFromSession(record, session);
    return {
      enrollment: synced,
      challenge_id: session.device_auth.challenge_id ?? "",
      challenge: session.device_auth.challenge ?? "",
      expires_at: session.device_auth.challenge_expires_at ?? new Date().toISOString()
    };
  }

  const now = new Date();
  const challengeId = randomId("deviceauth");
  const challenge = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  const expiresAt = new Date(
    now.getTime() + runtimeConfig.physicalDeviceAuthChallengeTtlSeconds * 1000
  ).toISOString();

  session.device_auth = {
    status: "pending",
    challenge_id: challengeId,
    challenge,
    challenge_expires_at: expiresAt
  };
  session.updated_at = now.toISOString();
  await upsertPhysicalSession(session);

  record.physical_verification = toPhysicalVerificationState(session);
  record.updated_at = now.toISOString();
  record.status = "device_auth_pending";
  record.last_user_message =
    "Device authentication is required on the device that will receive the Zik Pass.";
  await upsertEnrollment(record);

  return {
    enrollment: record,
    challenge_id: challengeId,
    challenge,
    expires_at: expiresAt
  };
}

export async function completePhysicalDeviceAuth(input: {
  enrollmentId: string;
  challengeId: string;
  method: PhysicalDeviceAuthState["method"];
  webauthnCredentialId?: string;
  clientDataJson?: string;
}): Promise<EnrollmentRecord> {
  const record = await getExistingEnrollment(input.enrollmentId);
  const session = await getLinkedPhysicalSession(record);

  ensurePhysicalEnrollmentUsable(record, session);

  if (session.clerk_verification.status !== "verified") {
    throw new Error("The in-person ID check must be confirmed before device authentication.");
  }

  if (!session.device_auth.challenge_id || !session.device_auth.challenge) {
    throw new Error("Start device authentication before completing it.");
  }

  if (session.device_auth.challenge_id !== input.challengeId) {
    throw new Error("This device authentication challenge is no longer valid.");
  }

  const challengeExpiry = new Date(session.device_auth.challenge_expires_at ?? 0).getTime();
  if (!challengeExpiry || challengeExpiry <= Date.now()) {
    throw new Error("This device authentication challenge has expired.");
  }

  if (input.method === "webauthn") {
    validateWebAuthnClientData(input.clientDataJson, session.device_auth.challenge);
  }

  const now = new Date().toISOString();
  session.device_auth = {
    status: "verified",
    method: input.method ?? "demo_device_check",
    challenge_id: session.device_auth.challenge_id,
    challenge: session.device_auth.challenge,
    challenge_expires_at: session.device_auth.challenge_expires_at,
    verified_at: now,
    credential_id: input.webauthnCredentialId
  };
  session.status = "ready_for_issuance";
  session.updated_at = now;

  record.physical_verification = toPhysicalVerificationState(session);
  record.status = "approved_with_cooling_off";
  record.updated_at = now;
  record.last_user_message = "Device authentication completed. We are issuing your in-person verified pass.";
  record.risk_decision = approvedRiskDecision(
    now,
    "In-person ID check and device authentication completed."
  );
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "device_auth_completed",
    `Device authentication completed using ${input.method === "webauthn" ? "WebAuthn" : "the demo device check"}.`,
    now
  );
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "cooling_off_started",
    "Physical issuance policy evaluated after in-person verification.",
    now
  );
  record.notifications.unshift(
    buildNotification("Device authentication completed for the in-person verification session.")
  );

  await upsertPhysicalSession(session);
  return persistAndFinalize(record);
}

async function startPhysicalEnrollment(input: {
  application: EnrollmentApplicationInput;
  holderPublicKey: JsonWebKey;
  applicationFingerprint: string;
}): Promise<EnrollmentRecord> {
  const duplicateState = await assertNoDuplicateApplication(input.applicationFingerprint);
  const physicalContext = input.application.physical_context;

  if (!physicalContext) {
    throw new Error("A valid in-store session is required for physical verification.");
  }

  const session = await getPhysicalStoreSessionOrThrow(physicalContext.session_id);

  if (session.enrollment_id) {
    throw new Error("This store session has already been used. Ask staff to start a new one.");
  }

  const now = new Date().toISOString();
  const record = createPhysicalEnrollmentRecord({
    createdAt: now,
    application: input.application,
    holderPublicKey: input.holderPublicKey,
    applicationFingerprint: input.applicationFingerprint,
    duplicateState,
    session
  });

  session.enrollment_id = record.id;
  session.user_code = record.physical_verification?.user_code.value;
  session.user_code_generated_at = record.physical_verification?.user_code.generated_at;
  session.user_code_expires_at = record.physical_verification?.user_code.expires_at;
  session.status = "claimed";
  session.updated_at = now;

  await upsertPhysicalSession(session);
  return upsertEnrollment(record);
}

function createEnrollmentRecord(input: {
  createdAt: string;
  application: EnrollmentApplicationInput;
  holderPublicKey: JsonWebKey;
  applicationFingerprint: string;
  duplicateState: DuplicateApplicationState;
  expectedCode: string;
}): EnrollmentRecord {
  const coolingEnds = buildCoolingOffEnd(input.createdAt, "remote");
  const providerSessionId = randomId("banksess");

  return {
    id: randomId("enroll"),
    lane: "remote",
    assurance_level: "remote_standard",
    issuance_channel: "remote",
    created_at: input.createdAt,
    updated_at: input.createdAt,
    onboarding_completed_at: input.createdAt,
    holder_key_registered_at: input.createdAt,
    application_fingerprint: input.applicationFingerprint,
    duplicate_state: input.duplicateState,
    application: input.application,
    proof: {
      type: "credit_adulthood_proof",
      signals: {
        has_primary_credit_account: false,
        oldest_account_age_months: 0,
        active_accounts_count: 0
      },
      derived: {
        confidence: "low"
      }
    },
    proof_evaluation: {
      approved: false,
      threshold_months: runtimeConfig.minOldestAccountMonths,
      reasons: ["Provider checks have not completed yet."]
    },
    holder_public_key: input.holderPublicKey,
    providers: {
      financial_check: emptyExecution("financial-check-provider"),
      cop: emptyExecution("cop-provider")
    },
    bank_verification: createBankVerificationState(
      input.application.bank_name,
      input.createdAt,
      providerSessionId,
      input.expectedCode
    ),
    cooling_off: {
      started_at: input.createdAt,
      ends_at: coolingEnds,
      duration_seconds: runtimeConfig.coolingOffSeconds,
      manually_advanced: false
    },
    risk_decision: pendingRiskDecision(input.createdAt),
    orchestration: createInitialOrchestration(input.createdAt),
    notifications: [
      buildNotification(
        "Application submitted. We are contacting the financial, Confirmation of Payee, and bank verification providers."
      )
    ],
    status: "application_submitted",
    provider_scenario: input.application.demo_scenario,
    last_user_message: "We are checking your details with our verification providers."
  };
}

function createPhysicalEnrollmentRecord(input: {
  createdAt: string;
  application: EnrollmentApplicationInput;
  holderPublicKey: JsonWebKey;
  applicationFingerprint: string;
  duplicateState: DuplicateApplicationState;
  session: PhysicalStoreSessionRecord;
}): EnrollmentRecord {
  const coolingEnds = buildCoolingOffEnd(input.createdAt, "physical");
  const codeGeneratedAt = input.createdAt;
  const userCodeExpiresAt = new Date(
    new Date(codeGeneratedAt).getTime() + runtimeConfig.physicalUserCodeTtlSeconds * 1000
  ).toISOString();
  const userCode = randomAlphaNumericCode(6);

  return {
    id: randomId("enroll"),
    lane: "physical",
    assurance_level: "in_person_verified",
    issuance_channel: "physical",
    created_at: input.createdAt,
    updated_at: input.createdAt,
    onboarding_completed_at: input.createdAt,
    holder_key_registered_at: input.createdAt,
    application_fingerprint: input.applicationFingerprint,
    duplicate_state: input.duplicateState,
    application: {
      ...input.application,
      lane: "physical",
      bank_name: input.application.bank_name || "In-store verification",
      physical_context: {
        session_id: input.session.session_id,
        store_id: input.session.store_id,
        store_name: input.session.store_name,
        location_id: input.session.location_id
      }
    },
    proof: {
      type: "credit_adulthood_proof",
      signals: {
        has_primary_credit_account: false,
        oldest_account_age_months: 0,
        active_accounts_count: 0
      },
      derived: {
        confidence: "high"
      }
    },
    proof_evaluation: {
      approved: true,
      threshold_months: runtimeConfig.minOldestAccountMonths,
      reasons: ["In-person verification is in progress."]
    },
    holder_public_key: input.holderPublicKey,
    providers: {
      financial_check: emptyExecution("financial-check-provider"),
      cop: emptyExecution("cop-provider")
    },
    bank_verification: createPlaceholderBankVerificationState(input.createdAt),
    physical_verification: {
      session: {
        session_id: input.session.session_id,
        store_id: input.session.store_id,
        store_name: input.session.store_name,
        location_id: input.session.location_id
      },
      session_expires_at: input.session.expires_at,
      status: "awaiting_clerk_verification",
      user_code: {
        value: userCode,
        generated_at: codeGeneratedAt,
        expires_at: userCodeExpiresAt
      },
      clerk_verification: {
        status: "pending"
      },
      device_auth: {
        status: "pending"
      }
    },
    cooling_off: {
      started_at: input.createdAt,
      ends_at: coolingEnds,
      duration_seconds: runtimeConfig.physicalCoolingOffSeconds,
      manually_advanced: runtimeConfig.physicalCoolingOffSeconds === 0
    },
    risk_decision: pendingPhysicalRiskDecision(input.createdAt),
    orchestration: pushOrchestrationEvent(
      createInitialOrchestration(input.createdAt),
      "in_person_verification_started",
      "Physical verification session created from store QR flow.",
      input.createdAt
    ),
    notifications: [
      buildNotification(
        `In-store verification started at ${input.session.store_name}. Show the session code to staff.`
      )
    ],
    status: "physical_verification_pending",
    provider_scenario: input.application.demo_scenario,
    last_user_message: "Show this code to a staff member to continue in-store verification."
  };
}

function createBankVerificationState(
  bankName: string,
  createdAt: string,
  providerSessionId: string,
  expectedCode: string
): BankVerificationState {
  return {
    bank_name: bankName,
    amount_gbp: 0.01,
    code: expectedCode,
    reference: `BANK-REF-${expectedCode}`,
    provider_session_id: providerSessionId,
    transaction_status: "pending",
    attempts: 0,
    max_attempts: runtimeConfig.bankVerificationMaxAttempts,
    sent_at: createdAt,
    provider_execution: {
      start: emptyExecution("bank-verification-provider"),
      confirm: emptyExecution("bank-verification-provider")
    }
  };
}

function createPlaceholderBankVerificationState(createdAt: string): BankVerificationState {
  return {
    bank_name: "In-store verification",
    amount_gbp: 0,
    code: "000000",
    reference: "IN-STORE",
    provider_session_id: randomId("physbank"),
    transaction_status: "confirmed",
    attempts: 0,
    max_attempts: 0,
    sent_at: createdAt,
    confirmed_at: createdAt,
    provider_execution: {
      start: emptyExecution("bank-verification-provider"),
      confirm: emptyExecution("bank-verification-provider")
    }
  };
}

function emptyExecution<Request, RawResponse, NormalizedResponse>(
  provider: string
): ProviderExecution<Request, RawResponse, NormalizedResponse> {
  return {
    provider,
    attempts: 0
  };
}

function pendingRiskDecision(now: string): ApplicationRiskDecision {
  return {
    state: "approved_with_cooling_off",
    reasons: ["Application is waiting for provider results."],
    retryable: false,
    requires_manual_review: false,
    eligible_for_cooling_off: false,
    eligible_for_issuance: false,
    evaluated_at: now
  };
}

function pendingPhysicalRiskDecision(now: string): ApplicationRiskDecision {
  return {
    state: "approved_with_cooling_off",
    reasons: ["In-person verification is waiting for staff confirmation and device authentication."],
    retryable: false,
    requires_manual_review: false,
    eligible_for_cooling_off: false,
    eligible_for_issuance: false,
    evaluated_at: now
  };
}

async function runInitialProviderPipeline(
  record: EnrollmentRecord,
  isRetry = false
): Promise<EnrollmentRecord> {
  await executeFinancialCheck(record);
  await executeCopCheck(record);
  await executeBankVerificationStart(record);

  if (isRetry) {
    record.notifications.unshift(
      buildNotification("External provider retry completed and the application status was refreshed.")
    );
  }

  return reevaluateEnrollment(record);
}

async function executeFinancialCheck(record: EnrollmentRecord): Promise<void> {
  const now = new Date().toISOString();
  const request = {
    application_id: record.id,
    verification_session_id: record.id,
    full_name: `${record.application.identity_match.first_name} ${record.application.identity_match.last_name}`.trim(),
    date_of_birth: record.application.identity_match.date_of_birth,
    current_address: record.application.identity_match.current_home_address,
    previous_address: record.application.identity_match.previous_address
  };

  record.providers.financial_check.attempts += 1;
  record.providers.financial_check.requested_at = now;
  record.providers.financial_check.request = request;
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "financial_check_requested",
    "Financial check provider request sent.",
    now
  );

  const result = await financialCheckProvider.runCheck({
    request,
    scenario: record.provider_scenario,
    attempts: record.providers.financial_check.attempts
  });

  record.providers.financial_check.completed_at = new Date().toISOString();
  record.providers.financial_check.latency_ms = result.latency_ms;
  record.providers.financial_check.raw_response = result.raw_response;
  record.providers.financial_check.normalized_response = result.normalized_response;
  record.financial_check_completed_at = record.providers.financial_check.completed_at;
}

async function executeCopCheck(record: EnrollmentRecord): Promise<void> {
  const now = new Date().toISOString();
  const request = {
    application_id: record.id,
    verification_session_id: record.id,
    entered_account_holder_name: `${record.application.identity_match.first_name} ${record.application.identity_match.last_name}`.trim(),
    bank_name: record.application.bank_name,
    simulated_account_hint: record.application_fingerprint.slice(0, 12)
  };

  record.providers.cop.attempts += 1;
  record.providers.cop.requested_at = now;
  record.providers.cop.request = request;
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "cop_requested",
    "Confirmation of Payee request sent.",
    now
  );

  const result = await copProvider.confirmPayee({
    request,
    scenario: record.provider_scenario,
    attempts: record.providers.cop.attempts
  });

  record.providers.cop.completed_at = new Date().toISOString();
  record.providers.cop.latency_ms = result.latency_ms;
  record.providers.cop.raw_response = result.raw_response;
  record.providers.cop.normalized_response = result.normalized_response;
  record.cop_completed_at = record.providers.cop.completed_at;
}

async function executeBankVerificationStart(record: EnrollmentRecord): Promise<void> {
  const now = new Date().toISOString();
  const request = {
    application_id: record.id,
    verification_session_id: record.bank_verification.provider_session_id,
    bank_name: record.application.bank_name,
    expected_reference_code: record.bank_verification.code
  };

  record.bank_verification.provider_execution.start.attempts += 1;
  record.bank_verification.provider_execution.start.requested_at = now;
  record.bank_verification.provider_execution.start.request = request;
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "bank_verification_started",
    "Bank verification provider started the refundable transaction flow.",
    now
  );

  const result = await bankVerificationProvider.startVerification({
    request,
    scenario: record.provider_scenario,
    attempts: record.bank_verification.provider_execution.start.attempts
  });

  record.bank_verification.provider_execution.start.completed_at = new Date().toISOString();
  record.bank_verification.provider_execution.start.latency_ms = result.latency_ms;
  record.bank_verification.provider_execution.start.raw_response = result.raw_response;
  record.bank_verification.provider_execution.start.normalized_response = result.normalized_response;
  record.bank_verification.provider_session_id = result.normalized_response.provider_session_id;
  record.bank_verification.amount_gbp = result.normalized_response.amount_gbp;
  record.bank_verification.reference = result.normalized_response.bank_reference;

  if (result.normalized_response.outcome === "transaction_sent") {
    record.bank_verification.transaction_status = "sent";
    record.last_user_message =
      "We sent a refundable GBP 0.01 verification reference to your selected bank.";
  } else {
    record.bank_verification.transaction_status =
      result.normalized_response.outcome === "timeout" ? "timeout" : "provider_unavailable";
  }
}

function reevaluateEnrollment(record: EnrollmentRecord): EnrollmentRecord {
  const now = new Date().toISOString();
  record.updated_at = now;
  record.duplicate_state.checked_at = now;
  record.proof = buildProofFromProviderResults(record);
  record.proof_evaluation = evaluateDerivedProof(record);

  const bankDecisionInput = selectBankDecisionInput(record);
  record.risk_decision = riskEngine.evaluate({
    duplicate_state: record.duplicate_state,
    financial_check: record.providers.financial_check.normalized_response,
    cop: record.providers.cop.normalized_response,
    bank_verification: bankDecisionInput
  });
  record.risk_evaluated_at = record.risk_decision.evaluated_at;
  record.manual_review_reason = record.risk_decision.requires_manual_review
    ? record.risk_decision.reasons[0]
    : undefined;
  record.last_retryable_error = buildOperationalError(record);

  const mappedStatus = mapDecisionStateToEnrollmentStatus(record.risk_decision.state, record.status);
  record.status = mappedStatus;

  if (
    record.bank_verification.transaction_status === "sent" &&
    mappedStatus === "approved_with_cooling_off"
  ) {
    record.status = "bank_verification_pending";
  }

  if (
    record.status === "approved_with_cooling_off" &&
    record.bank_verification.transaction_status === "confirmed"
  ) {
    record.credential_pending_at ??= now;
    record.orchestration = pushOrchestrationEvent(
      record.orchestration,
      "risk_engine_evaluated",
      "Risk engine approved the application and cooling-off can begin.",
      now
    );
    record.orchestration = pushOrchestrationEvent(
      record.orchestration,
      "cooling_off_started",
      "Cooling-off started before credential issuance.",
      now
    );
    record.last_user_message =
      "Your provider checks are complete. Cooling-off is now protecting your pass before it can be issued.";
  } else if (record.status === "bank_verification_pending") {
    record.last_user_message ??=
      "We need one final bank confirmation code before your pass can move into issuance.";
  } else if (record.status === "retry_provider_failure") {
    record.orchestration = pushOrchestrationEvent(
      record.orchestration,
      "retry_required",
      "A provider returned a retryable failure.",
      now
    );
    record.last_user_message = "We could not complete your check right now. Please try again.";
  } else if (record.status === "approved_pending_review" || record.status === "manual_review_required") {
    record.orchestration = pushOrchestrationEvent(
      record.orchestration,
      "manual_review_required",
      "The application requires issuer review before issuance.",
      now
    );
    record.last_user_message = "This application needs additional review.";
  } else if (record.status.startsWith("declined_")) {
    record.orchestration = pushOrchestrationEvent(
      record.orchestration,
      "declined",
      "The application did not pass the provider and risk checks.",
      now
    );
    record.last_user_message = humanizeDeclineMessage(record.status);
  }

  return record;
}

function selectBankDecisionInput(
  record: EnrollmentRecord
): BankVerificationNormalizedResponse | undefined {
  const confirmResult = record.bank_verification.provider_execution.confirm.normalized_response;

  if (confirmResult?.outcome === "code_invalid" && record.bank_verification.attempts < record.bank_verification.max_attempts) {
    return undefined;
  }

  return confirmResult ?? record.bank_verification.provider_execution.start.normalized_response;
}

function buildOperationalError(record: EnrollmentRecord): ProviderErrorShape | undefined {
  const financialOutcome = record.providers.financial_check.normalized_response?.outcome;
  if (financialOutcome === "provider_unavailable" || financialOutcome === "timeout") {
    return createProviderError(
      "financial-check-provider",
      financialOutcome,
      "Financial provider did not complete successfully.",
      true,
      record.updated_at
    );
  }

  const copOutcome = record.providers.cop.normalized_response?.outcome;
  if (copOutcome === "unavailable") {
    return createProviderError(
      "cop-provider",
      "provider_unavailable",
      "Confirmation of Payee provider is unavailable.",
      true,
      record.updated_at
    );
  }

  const bankOutcome =
    record.bank_verification.provider_execution.confirm.normalized_response?.outcome ??
    record.bank_verification.provider_execution.start.normalized_response?.outcome;

  if (bankOutcome === "provider_unavailable" || bankOutcome === "timeout") {
    return createProviderError(
      "bank-verification-provider",
      bankOutcome,
      "Bank verification provider returned an operational failure.",
      true,
      record.updated_at
    );
  }

  return undefined;
}

function humanizeDeclineMessage(status: EnrollmentRecord["status"]): string {
  switch (status) {
    case "declined_identity_mismatch":
      return "We could not confidently verify your details.";
    case "declined_no_adult_signal":
      return "We could not find a strong enough adult financial signal.";
    case "declined_bank_control_failed":
      return "We could not confirm control of the selected bank account.";
    case "declined_duplicate_application":
      return "An active Zik Pass application already exists for these details.";
    default:
      return "This application could not be approved.";
  }
}

function createProviderError(
  provider: string,
  code: ProviderErrorShape["code"],
  message: string,
  retryable: boolean,
  occurredAt: string
): ProviderErrorShape {
  return {
    provider,
    code,
    message,
    retryable,
    occurred_at: occurredAt
  };
}

function coolingOffSatisfied(record: EnrollmentRecord): boolean {
  if (record.cooling_off.manually_advanced) {
    return true;
  }

  return new Date(record.cooling_off.ends_at).getTime() <= Date.now();
}

async function getExistingEnrollment(enrollmentId: string): Promise<EnrollmentRecord> {
  const record = await getEnrollment(enrollmentId);

  if (!record) {
    throw new Error("Enrollment record not found.");
  }

  const refreshedDuplicateState = await checkDuplicateApplication(record.application_fingerprint);
  record.duplicate_state = refreshedDuplicateState.blocked && refreshedDuplicateState.existing_enrollment_id === record.id
    ? { ...refreshedDuplicateState, blocked: false, reason: undefined }
    : refreshedDuplicateState;

  if (record.lane === "physical" && record.physical_verification) {
    const session = await getPhysicalSession(record.physical_verification.session.session_id);

    if (session) {
      return syncPhysicalEnrollmentFromSession(record, session);
    }
  }

  return record;
}

async function persistAndFinalize(record: EnrollmentRecord): Promise<EnrollmentRecord> {
  const storedRecord = await upsertEnrollment(record);
  return finalizeIssuanceIfReady(storedRecord);
}

async function finalizeIssuanceIfReady(record: EnrollmentRecord): Promise<EnrollmentRecord> {
  if (record.issued_credential) {
    return record;
  }

  if (record.status !== "approved_with_cooling_off") {
    return record;
  }

  if (record.lane === "remote" && record.bank_verification.transaction_status !== "confirmed") {
    return record;
  }

  if (record.lane === "physical") {
    const session = await getLinkedPhysicalSession(record);

    if (session.clerk_verification.status !== "verified" || session.device_auth.status !== "verified") {
      return record;
    }
  }

  if (!coolingOffSatisfied(record)) {
    return record;
  }

  const now = new Date().toISOString();
  record.cooling_off.satisfied_at ??= now;
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "cooling_off_completed",
    "Cooling-off completed and issuance eligibility was rechecked.",
    now
  );
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "issuance_eligibility_confirmed",
    "All pre-issuance checks completed successfully.",
    now
  );
  return signIssuedCredential(record);
}

async function signIssuedCredential(record: EnrollmentRecord): Promise<EnrollmentRecord> {
  const now = new Date().toISOString();

  record.status = "credential_pending_issuance";
  record.credential_pending_at ??= now;
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "credential_signed",
    "Credential signing started.",
    now
  );
  record.orchestration.issuance_status = "signing";

  record.issued_credential = await issueCredential(record);
  record.issuer_signature_created_at = new Date().toISOString();
  record.status = "issued";
  record.updated_at = record.issuer_signature_created_at;
  record.orchestration = pushOrchestrationEvent(
    record.orchestration,
    "credential_returned",
    "Credential signed and returned to the holder device.",
    record.updated_at
  );
  record.orchestration.issuance_status = "issued";
  record.notifications.unshift(
    buildNotification(
      "Cooling-off finished. Zik signed the credential and returned it to the holder wallet."
    )
  );
  record.last_user_message = "Your Zik Pass is ready to use.";

  if (record.lane === "physical" && record.physical_verification) {
    record.physical_verification.status = "issued";
    record.physical_verification.completed_at = record.updated_at;

    const session = await getLinkedPhysicalSession(record);
    session.status = "completed";
    session.code_consumed_at ??= record.updated_at;
    session.completed_at = record.updated_at;
    session.updated_at = record.updated_at;
    await upsertPhysicalSession(session);
  }

  return upsertEnrollment(record);
}

function buildCoolingOffEnd(createdAt: string, lane: EnrollmentRecord["lane"]): string {
  const durationSeconds =
    lane === "physical" ? runtimeConfig.physicalCoolingOffSeconds : runtimeConfig.coolingOffSeconds;

  return new Date(new Date(createdAt).getTime() + durationSeconds * 1000).toISOString();
}

function approvedRiskDecision(now: string, reason: string): ApplicationRiskDecision {
  return {
    state: "approved",
    reasons: [reason],
    retryable: false,
    requires_manual_review: false,
    eligible_for_cooling_off: true,
    eligible_for_issuance: true,
    evaluated_at: now
  };
}

function isPhysicalSessionExpired(session: PhysicalStoreSessionRecord): boolean {
  return new Date(session.expires_at).getTime() <= Date.now();
}

async function getPhysicalEnrollmentForSession(
  session: PhysicalStoreSessionRecord
): Promise<EnrollmentRecord> {
  if (!session.enrollment_id) {
    throw new Error("This store session has not been linked to a user yet.");
  }

  return getExistingEnrollment(session.enrollment_id);
}

async function getLinkedPhysicalSession(record: EnrollmentRecord): Promise<PhysicalStoreSessionRecord> {
  const sessionId = record.physical_verification?.session.session_id;

  if (!sessionId) {
    throw new Error("No physical store session is linked to this enrollment.");
  }

  return getPhysicalStoreSessionOrThrow(sessionId);
}

function ensurePhysicalEnrollmentUsable(
  record: EnrollmentRecord,
  session: PhysicalStoreSessionRecord
): void {
  if (record.lane !== "physical" || !record.physical_verification) {
    throw new Error("This enrollment is not using the in-person verification lane.");
  }

  const codeExpiry = new Date(record.physical_verification.user_code.expires_at).getTime();
  if (!record.issued_credential && (isPhysicalSessionExpired(session) || codeExpiry <= Date.now())) {
    throw new Error("This in-person verification session has expired. Ask staff to start again.");
  }

  if (session.status === "completed" && !record.issued_credential) {
    throw new Error("This in-person verification session has already been completed.");
  }

  if (record.status === "verification_session_expired") {
    throw new Error("This in-person verification session has expired.");
  }
}

async function syncPhysicalEnrollmentFromSession(
  record: EnrollmentRecord,
  session: PhysicalStoreSessionRecord
): Promise<EnrollmentRecord> {
  if (record.lane !== "physical" || !record.physical_verification) {
    return record;
  }

  const now = new Date().toISOString();
  const expired =
    isPhysicalSessionExpired(session) ||
    new Date(record.physical_verification.user_code.expires_at).getTime() <= Date.now();

  record.physical_verification = toPhysicalVerificationState(session, record.physical_verification);
  record.updated_at = now;

  if (record.issued_credential) {
    record.physical_verification.status = "issued";
    record.status = "issued";
    return upsertEnrollment(record);
  }

  if (expired) {
    session.status = "expired";
    session.updated_at = now;
    record.status = "verification_session_expired";
    record.last_user_message = "This in-store session expired before verification finished.";
    record.physical_verification.status = "expired";
    await upsertPhysicalSession(session);
    return upsertEnrollment(record);
  }

  if (session.clerk_verification.status !== "verified") {
    record.status = "physical_verification_pending";
    record.last_user_message = "Show this code to a staff member to continue in-store verification.";
    return upsertEnrollment(record);
  }

  if (session.device_auth.status !== "verified") {
    record.status = "device_auth_pending";
    record.last_user_message =
      "ID check confirmed. Complete device authentication on this device to continue.";
    return upsertEnrollment(record);
  }

  record.status = "approved_with_cooling_off";
  record.risk_decision = approvedRiskDecision(
    now,
    "In-person verification completed successfully."
  );
  record.last_user_message = "In-person verification completed. Your pass is being issued.";
  return upsertEnrollment(record);
}

function toPhysicalVerificationState(
  session: PhysicalStoreSessionRecord,
  existing?: PhysicalVerificationState
): PhysicalVerificationState {
  const userCode = existing?.user_code ?? {
    value: session.user_code ?? randomAlphaNumericCode(6),
    generated_at: session.user_code_generated_at ?? session.created_at,
    expires_at: session.user_code_expires_at ?? session.expires_at
  };

  let status: PhysicalVerificationState["status"] = "awaiting_clerk_verification";
  if (session.status === "completed") {
    status = "issued";
  } else if (session.status === "expired") {
    status = "expired";
  } else if (session.device_auth.status === "verified" && session.clerk_verification.status === "verified") {
    status = "verification_complete";
  } else if (session.clerk_verification.status === "verified") {
    status = "awaiting_device_auth";
  }

  return {
    session: {
      session_id: session.session_id,
      store_id: session.store_id,
      store_name: session.store_name,
      location_id: session.location_id
    },
    session_expires_at: session.expires_at,
    status,
    user_code: {
      value: userCode.value,
      generated_at: userCode.generated_at,
      expires_at: userCode.expires_at,
      consumed_at: session.code_consumed_at ?? existing?.user_code.consumed_at
    },
    clerk_verification: session.clerk_verification,
    device_auth: session.device_auth,
    completed_at: session.completed_at ?? existing?.completed_at
  };
}

function validateWebAuthnClientData(clientDataJson: string | undefined, expectedChallenge: string): void {
  if (!clientDataJson) {
    throw new Error("Device authentication did not return the required WebAuthn data.");
  }

  let parsed: { challenge?: string; type?: string } | undefined;

  try {
    parsed = JSON.parse(Buffer.from(clientDataJson, "base64url").toString("utf8")) as {
      challenge?: string;
      type?: string;
    };
  } catch {
    throw new Error("WebAuthn returned malformed client data.");
  }

  if (parsed?.challenge !== expectedChallenge) {
    throw new Error("The WebAuthn response did not match the active device authentication challenge.");
  }

  if (parsed.type !== "webauthn.get" && parsed.type !== "webauthn.create") {
    throw new Error("Unsupported WebAuthn response type.");
  }
}
