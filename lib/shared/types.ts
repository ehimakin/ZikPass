import type {
  ApplicationRiskDecision,
  BankVerificationConfirmRequest,
  BankVerificationNormalizedResponse,
  BankVerificationRawResponse,
  BankVerificationStartRequest,
  CopNormalizedResponse,
  CopRawResponse,
  CopRequest,
  FinancialCheckNormalizedResponse,
  FinancialCheckRawResponse,
  FinancialCheckRequest,
  OrchestrationEvent,
  ProviderErrorShape,
  ProviderExecution,
  ProviderSimulatorScenario
} from "@/lib/shared/provider-contracts";

export type ConfidenceLevel = "low" | "medium" | "high";
export type IssuanceLane = "remote" | "physical";
export type AssuranceLevel = "remote_standard" | "in_person_verified";
export type IssuanceChannel = "remote" | "physical";
export type VerificationMethod = "remote_financial" | "physical_id_check";

export interface CreditAdulthoodProof {
  type: "credit_adulthood_proof";
  signals: {
    has_primary_credit_account: boolean;
    oldest_account_age_months: number;
    active_accounts_count: number;
  };
  derived: {
    confidence: ConfidenceLevel;
  };
}

export interface ProofEvaluation {
  approved: boolean;
  threshold_months: number;
  reasons: string[];
}

export interface NotificationRecord {
  id: string;
  channel: "email" | "sms" | "in_app";
  message: string;
  created_at: string;
}

export interface CoolingOffState {
  started_at: string;
  ends_at: string;
  duration_seconds: number;
  manually_advanced: boolean;
  satisfied_at?: string;
}

export interface BankVerificationState {
  bank_name: string;
  amount_gbp: number;
  code: string;
  reference: string;
  provider_session_id: string;
  transaction_status:
    | "pending"
    | "sent"
    | "confirmed"
    | "failed"
    | "provider_unavailable"
    | "timeout";
  attempts: number;
  max_attempts: number;
  sent_at: string;
  confirmed_at?: string;
  failed_at?: string;
  provider_execution: {
    start: ProviderExecution<
      BankVerificationStartRequest,
      BankVerificationRawResponse,
      BankVerificationNormalizedResponse
    >;
    confirm: ProviderExecution<
      BankVerificationConfirmRequest,
      BankVerificationRawResponse,
      BankVerificationNormalizedResponse
    >;
  };
}

export interface PhysicalStoreContext {
  session_id: string;
  store_id: string;
  store_name: string;
  location_id: string;
}

export interface PhysicalUserCodeState {
  value: string;
  generated_at: string;
  expires_at: string;
  consumed_at?: string;
}

export interface PhysicalClerkVerificationState {
  status: "pending" | "verified" | "rejected";
  checked_at?: string;
  checked_by?: string;
  verifier_id?: string;
  retailer_id?: string;
  verification_method?: "physical_id_check";
  note?: string;
}

export interface PhysicalVerificationAttestation {
  session_id: string;
  over_18: boolean;
  verification_method: "physical_id_check";
  verifier_id: string;
  retailer_id: string;
  location_id: string;
  verified_at: string;
}

export interface PhysicalDeviceAuthState {
  status: "pending" | "verified";
  method?: "webauthn" | "demo_device_check";
  challenge_id?: string;
  challenge?: string;
  challenge_expires_at?: string;
  verified_at?: string;
  credential_id?: string;
}

export interface PhysicalVerificationState {
  session: PhysicalStoreContext;
  session_expires_at: string;
  status:
    | "session_detected"
    | "awaiting_code_display"
    | "awaiting_clerk_verification"
    | "awaiting_device_auth"
    | "verification_complete"
    | "expired"
    | "rejected"
    | "issued";
  user_code: PhysicalUserCodeState;
  clerk_verification: PhysicalClerkVerificationState;
  device_auth: PhysicalDeviceAuthState;
  attestation?: PhysicalVerificationAttestation;
  completed_at?: string;
}

export interface PhysicalStoreSessionRecord extends PhysicalStoreContext {
  created_at: string;
  updated_at: string;
  expires_at: string;
  enrollment_id?: string;
  status:
    | "open"
    | "claimed"
    | "awaiting_device_auth"
    | "ready_for_issuance"
    | "completed"
    | "expired"
    | "rejected"
    | "cancelled";
  user_code?: string;
  user_code_generated_at?: string;
  user_code_expires_at?: string;
  code_consumed_at?: string;
  clerk_verification: PhysicalClerkVerificationState;
  device_auth: PhysicalDeviceAuthState;
  attestation?: PhysicalVerificationAttestation;
  completed_at?: string;
  minimized_at?: string;
}

export type EnrollmentStatus =
  | "application_submitted"
  | "bank_verification_pending"
  | "physical_verification_pending"
  | "device_auth_pending"
  | "retry_provider_failure"
  | "manual_review_required"
  | "approved_with_cooling_off"
  | "approved_pending_review"
  | "credential_pending_issuance"
  | "issued"
  | "verification_session_expired"
  | "declined_physical_verification"
  | "declined_identity_mismatch"
  | "declined_no_adult_signal"
  | "declined_bank_control_failed"
  | "declined_duplicate_application";

export type DeviceWalletStatus =
  | "no_pass_on_device"
  | "pass_pending_issuance"
  | "pass_issued_and_stored_locally"
  | "pass_expired";

export interface AgeCredential {
  credential_id: string;
  over18: boolean;
  issuer: "Zik Pass";
  issued_at: string;
  activates_at: string;
  expires_at: string;
  assurance_level: AssuranceLevel;
  issuance_channel: IssuanceChannel;
  verification_method: VerificationMethod;
  physical_attestation?: Pick<
    PhysicalVerificationAttestation,
    "session_id" | "verification_method" | "verifier_id" | "retailer_id" | "location_id" | "verified_at"
  >;
  subject_public_key: JsonWebKey;
}

export interface SignedCredential {
  payload: AgeCredential;
  zignature: string;
  algorithm: "Ed25519";
}

export interface PresentationBundle {
  credential: SignedCredential;
  challenge: string;
  holder_signature: string;
  holder_algorithm: "Ed25519";
  presented_at: string;
}

export interface VerificationChecks {
  issuer_signature_valid: boolean;
  holder_signature_valid: boolean;
  active: boolean;
  not_expired: boolean;
  claim_over18: boolean;
}

export interface VerificationResult {
  checks: VerificationChecks;
  decision: "allow" | "deny";
  verified_at: string;
}

export interface IdentityMatchInput {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_home_address: string;
  previous_address?: string;
}

export interface EnrollmentApplicationInput {
  identity_match?: IdentityMatchInput;
  bank_name: string;
  submitted_at: string;
  demo_scenario?: ProviderSimulatorScenario;
  lane?: IssuanceLane;
  physical_context?: PhysicalStoreContext;
}

export interface DuplicateApplicationState {
  blocked: boolean;
  existing_enrollment_id?: string;
  reason?:
    | "existing_pending_application"
    | "cooling_off_in_progress"
    | "existing_issued_pass";
  checked_at: string;
}

export interface ProviderStates {
  financial_check: ProviderExecution<
    FinancialCheckRequest,
    FinancialCheckRawResponse,
    FinancialCheckNormalizedResponse
  >;
  cop: ProviderExecution<CopRequest, CopRawResponse, CopNormalizedResponse>;
}

export interface IssuanceOrchestrationState {
  stage:
    | "application_submitted"
    | "financial_check_requested"
    | "cop_requested"
    | "bank_verification_started"
    | "bank_verification_completed"
    | "in_person_verification_started"
    | "in_person_verification_completed"
    | "device_auth_completed"
    | "risk_engine_evaluated"
    | "cooling_off_started"
    | "cooling_off_completed"
    | "issuance_eligibility_confirmed"
    | "credential_signed"
    | "credential_returned"
    | "manual_review_required"
    | "declined"
    | "retry_required";
  events: OrchestrationEvent[];
  last_transition_at: string;
  issuance_status:
    | "not_started"
    | "cooling_off"
    | "eligible"
    | "signing"
    | "issued"
    | "blocked";
}

export interface EnrollmentRecord {
  id: string;
  lane: IssuanceLane;
  assurance_level: AssuranceLevel;
  issuance_channel: IssuanceChannel;
  created_at: string;
  updated_at: string;
  onboarding_completed_at: string;
  holder_key_registered_at: string;
  financial_check_completed_at?: string;
  cop_completed_at?: string;
  bank_verification_completed_at?: string;
  risk_evaluated_at?: string;
  credential_pending_at?: string;
  issuer_signature_created_at?: string;
  application_fingerprint: string;
  duplicate_state: DuplicateApplicationState;
  application: EnrollmentApplicationInput;
  proof: CreditAdulthoodProof;
  proof_evaluation: ProofEvaluation;
  holder_public_key: JsonWebKey;
  providers: ProviderStates;
  bank_verification: BankVerificationState;
  physical_verification?: PhysicalVerificationState;
  cooling_off: CoolingOffState;
  risk_decision: ApplicationRiskDecision;
  orchestration: IssuanceOrchestrationState;
  notifications: NotificationRecord[];
  status: EnrollmentStatus;
  manual_review_reason?: string;
  provider_scenario?: ProviderSimulatorScenario;
  last_user_message?: string;
  last_retryable_error?: ProviderErrorShape;
  issued_credential?: SignedCredential;
}

export interface WalletState {
  holderKeyPair?: {
    publicKeyJwk: JsonWebKey;
    privateKeyJwk: JsonWebKey;
  };
  credential?: SignedCredential;
  enrollmentId?: string;
  enrollmentLane?: IssuanceLane;
  physicalSessionId?: string;
  localCredentialStoredAt?: string;
}

export interface WalletStatusSnapshot {
  status: DeviceWalletStatus;
  has_holder_key: boolean;
  has_credential: boolean;
  blocks_new_pass: boolean;
  credential_active: boolean;
  credential_expired: boolean;
}
