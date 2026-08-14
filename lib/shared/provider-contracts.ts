export type ProviderSimulatorScenario =
  | "clean_adult_match"
  | "weak_financial_match"
  | "no_adult_signal"
  | "address_mismatch"
  | "name_mismatch"
  | "cop_partial_match"
  | "cop_no_match"
  | "bank_verification_success"
  | "bank_verification_code_failure"
  | "provider_unavailable"
  | "provider_timeout"
  | "manual_review_required";

export type ProviderFailureCode =
  | "provider_unavailable"
  | "timeout"
  | "error"
  | "invalid_request";

export interface ProviderErrorShape {
  provider: string;
  code: ProviderFailureCode;
  message: string;
  retryable: boolean;
  occurred_at: string;
}

export interface ProviderExecution<Request, RawResponse, NormalizedResponse> {
  provider: string;
  attempts: number;
  requested_at?: string;
  completed_at?: string;
  latency_ms?: number;
  request?: Request;
  raw_response?: RawResponse;
  normalized_response?: NormalizedResponse;
  last_error?: ProviderErrorShape;
}

export interface FinancialCheckRequest {
  application_id: string;
  verification_session_id: string;
  full_name: string;
  date_of_birth: string;
  current_address: string;
  previous_address?: string;
}

export interface FinancialCheckRawResponse {
  provider_request_id: string;
  status:
    | "match"
    | "partial_match"
    | "manual_review"
    | "no_match"
    | "adult_signal_missing"
    | "provider_unavailable"
    | "timeout"
    | "error";
  identity_match_score: number;
  adult_signal_confidence: number;
  has_primary_credit_account: boolean;
  oldest_account_age_months: number;
  active_accounts_count: number;
  matched_fields: string[];
  reason_codes: string[];
}

export type FinancialCheckOutcome =
  | "match_high_confidence"
  | "match_medium_confidence"
  | "weak_match"
  | "no_match"
  | "adult_signal_missing"
  | "manual_review_required"
  | "provider_unavailable"
  | "timeout"
  | "error";

export interface FinancialCheckNormalizedResponse {
  outcome: FinancialCheckOutcome;
  provider_reference: string;
  has_primary_credit_account: boolean;
  oldest_account_age_months: number;
  active_accounts_count: number;
  identity_match_score: number;
  adult_signal_confidence: number;
  matched_fields: string[];
  retryable: boolean;
  manual_review_reason?: string;
}

export interface CopRequest {
  application_id: string;
  verification_session_id: string;
  entered_account_holder_name: string;
  bank_name: string;
  simulated_account_hint: string;
}

export interface CopRawResponse {
  provider_request_id: string;
  status: "full_match" | "partial_match" | "no_match" | "unavailable" | "error";
  matched_name: string;
  confidence_score: number;
  reason_codes: string[];
}

export type CopOutcome =
  | "full_match"
  | "partial_match"
  | "no_match"
  | "unavailable"
  | "error";

export interface CopNormalizedResponse {
  outcome: CopOutcome;
  provider_reference: string;
  matched_name: string;
  confidence_score: number;
  retryable: boolean;
  reason_codes: string[];
}

export interface BankVerificationStartRequest {
  application_id: string;
  verification_session_id: string;
  bank_name: string;
  expected_reference_code: string;
}

export interface BankVerificationConfirmRequest {
  application_id: string;
  verification_session_id: string;
  expected_reference_code: string;
  user_entered_code: string;
}

export interface BankVerificationRawResponse {
  provider_request_id: string;
  provider_session_id: string;
  status:
    | "pending"
    | "transaction_sent"
    | "code_confirmed"
    | "code_invalid"
    | "verification_failed"
    | "provider_unavailable"
    | "timeout"
    | "error";
  amount_gbp: number;
  bank_reference: string;
  expected_code: string;
  failure_reason?: string;
}

export type BankVerificationOutcome =
  | "pending"
  | "transaction_sent"
  | "code_confirmed"
  | "code_invalid"
  | "verification_failed"
  | "provider_unavailable"
  | "timeout";

export interface BankVerificationNormalizedResponse {
  outcome: BankVerificationOutcome;
  provider_reference: string;
  provider_session_id: string;
  amount_gbp: number;
  bank_reference: string;
  expected_code: string;
  retryable: boolean;
  failure_reason?: string;
}

export type ApplicationRiskDecisionState =
  | "approved"
  | "approved_with_cooling_off"
  | "approved_pending_review"
  | "declined_identity_mismatch"
  | "declined_no_adult_signal"
  | "declined_bank_control_failed"
  | "declined_duplicate_application"
  | "retry_provider_failure"
  | "manual_review_required";

export interface ApplicationRiskDecision {
  state: ApplicationRiskDecisionState;
  reasons: string[];
  retryable: boolean;
  requires_manual_review: boolean;
  eligible_for_cooling_off: boolean;
  eligible_for_issuance: boolean;
  evaluated_at: string;
}

export type IssuanceStage =
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

export interface OrchestrationEvent {
  stage: IssuanceStage;
  at: string;
  detail: string;
}
