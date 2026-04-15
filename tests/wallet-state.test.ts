import { describe, expect, it } from "vitest";
import type { EnrollmentRecord, SignedCredential, WalletState } from "@/lib/shared/types";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";

function buildCredential(overrides?: Partial<SignedCredential["payload"]>): SignedCredential {
  return {
    payload: {
      credential_id: "zp_demo123",
      over18: true,
      issuer: "Zik Pass",
      issued_at: "2026-04-12T12:00:00.000Z",
      activates_at: "2026-04-12T12:05:00.000Z",
      expires_at: "2027-04-12T12:00:00.000Z",
      assurance_level: "remote_standard",
      issuance_channel: "remote",
      subject_public_key: {
        key_ops: ["verify"],
        ext: true,
        crv: "Ed25519",
        kty: "OKP",
        x: "demo"
      },
      ...overrides
    },
    zignature: "sig_demo",
    algorithm: "Ed25519"
  };
}

function buildPendingEnrollment(): EnrollmentRecord {
  return {
    id: "enroll_demo",
    lane: "remote",
    assurance_level: "remote_standard",
    issuance_channel: "remote",
    created_at: "2026-04-12T12:00:00.000Z",
    updated_at: "2026-04-12T12:00:00.000Z",
    onboarding_completed_at: "2026-04-12T12:00:00.000Z",
    holder_key_registered_at: "2026-04-12T12:00:00.000Z",
    financial_check_completed_at: "2026-04-12T12:00:00.000Z",
    bank_verification_completed_at: "2026-04-12T12:01:00.000Z",
    credential_pending_at: "2026-04-12T12:01:00.000Z",
    application_fingerprint: "abc123",
    duplicate_state: {
      blocked: false,
      checked_at: "2026-04-12T12:00:00.000Z"
    },
    application: {
      identity_match: {
        first_name: "Alice",
        last_name: "Example",
        date_of_birth: "1995-01-01",
        current_home_address: "10 High Street"
      },
      bank_name: "Monzo",
      submitted_at: "2026-04-12T12:00:00.000Z"
    },
    proof: {
      type: "credit_adulthood_proof",
      signals: {
        has_primary_credit_account: true,
        oldest_account_age_months: 24,
        active_accounts_count: 2
      },
      derived: {
        confidence: "high"
      }
    },
    proof_evaluation: {
      approved: true,
      threshold_months: 12,
      reasons: []
    },
    holder_public_key: {
      key_ops: ["verify"],
      ext: true,
      crv: "Ed25519",
      kty: "OKP",
      x: "demo"
    },
    providers: {
      financial_check: {
        provider: "financial-check-provider",
        attempts: 1
      },
      cop: {
        provider: "cop-provider",
        attempts: 1
      }
    },
    bank_verification: {
      bank_name: "Monzo",
      amount_gbp: 0.01,
      code: "123456",
      reference: "BANK-REF-123456",
      provider_session_id: "banksess_demo",
      transaction_status: "confirmed",
      attempts: 1,
      max_attempts: 3,
      sent_at: "2026-04-12T12:00:00.000Z",
      confirmed_at: "2026-04-12T12:01:00.000Z",
      provider_execution: {
        start: {
          provider: "bank-verification-provider",
          attempts: 1
        },
        confirm: {
          provider: "bank-verification-provider",
          attempts: 1
        }
      }
    },
    cooling_off: {
      started_at: "2026-04-12T12:00:00.000Z",
      ends_at: "2026-04-12T12:10:00.000Z",
      duration_seconds: 600,
      manually_advanced: false
    },
    risk_decision: {
      state: "approved",
      reasons: [],
      retryable: false,
      requires_manual_review: false,
      eligible_for_cooling_off: true,
      eligible_for_issuance: true,
      evaluated_at: "2026-04-12T12:01:00.000Z"
    },
    orchestration: {
      stage: "cooling_off_started",
      events: [],
      last_transition_at: "2026-04-12T12:01:00.000Z",
      issuance_status: "cooling_off"
    },
    notifications: [],
    status: "approved_with_cooling_off"
  };
}

describe("getWalletStatusSnapshot", () => {
  it("reports a pending issuance when the device has keys and the enrollment is cooling off", () => {
    const wallet: WalletState = {
      holderKeyPair: {
        publicKeyJwk: { kty: "OKP" },
        privateKeyJwk: { kty: "OKP" }
      },
      enrollmentId: "enroll_demo"
    };

    const snapshot = getWalletStatusSnapshot(
      wallet,
      buildPendingEnrollment(),
      new Date("2026-04-12T12:02:00.000Z")
    );

    expect(snapshot.status).toBe("pass_pending_issuance");
    expect(snapshot.has_holder_key).toBe(true);
    expect(snapshot.blocks_new_pass).toBe(false);
  });

  it("reports an active stored pass when the credential is current", () => {
    const snapshot = getWalletStatusSnapshot(
      {
        credential: buildCredential(),
        holderKeyPair: {
          publicKeyJwk: { kty: "OKP" },
          privateKeyJwk: { kty: "OKP" }
        }
      },
      null,
      new Date("2026-04-12T12:06:00.000Z")
    );

    expect(snapshot.status).toBe("pass_issued_and_stored_locally");
    expect(snapshot.credential_active).toBe(true);
    expect(snapshot.blocks_new_pass).toBe(true);
  });

  it("reports an expired stored pass once expiry has passed", () => {
    const snapshot = getWalletStatusSnapshot(
      {
        credential: buildCredential({
          expires_at: "2026-04-12T12:06:00.000Z"
        })
      },
      null,
      new Date("2026-04-12T12:07:00.000Z")
    );

    expect(snapshot.status).toBe("pass_expired");
    expect(snapshot.credential_expired).toBe(true);
    expect(snapshot.blocks_new_pass).toBe(true);
  });
});
