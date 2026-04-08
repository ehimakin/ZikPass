export type ConfidenceLevel = "low" | "medium" | "high";

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

export interface PossessionState {
  code: string;
  reference: string;
  status: "pending" | "verified";
  attempts: number;
  verified_at?: string;
}

export interface AgeCredential {
  credential_id: string;
  over18: boolean;
  issuer: "Zik Pass";
  issued_at: string;
  activates_at: string;
  expires_at: string;
  assurance_level: "medium";
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

export interface EnrollmentRecord {
  id: string;
  created_at: string;
  updated_at: string;
  proof: CreditAdulthoodProof;
  proof_evaluation: ProofEvaluation;
  holder_public_key: JsonWebKey;
  possession: PossessionState;
  cooling_off: CoolingOffState;
  notifications: NotificationRecord[];
  status:
    | "proof_rejected"
    | "awaiting_possession"
    | "issued_cooling_off"
    | "issued";
  issued_credential?: SignedCredential;
}

export interface WalletState {
  holderKeyPair?: {
    publicKeyJwk: JsonWebKey;
    privateKeyJwk: JsonWebKey;
  };
  credential?: SignedCredential;
  enrollmentId?: string;
}

export interface IdentityMatchInput {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  current_home_address: string;
  previous_address?: string;
}
