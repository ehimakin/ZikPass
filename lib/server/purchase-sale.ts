import { createHash, createPublicKey, randomBytes } from "node:crypto";
import { runtimeConfig } from "@/lib/shared/config";
import { getStoreById } from "@/lib/shared/stores";
import { randomId } from "@/lib/shared/utils";
import type { JsonWebKey as NodeJsonWebKey } from "node:crypto";
import type { PhysicalStoreSessionRecord, EnrollmentRecord, PaymentRecord } from "@/lib/shared/types";
import { authenticateRetailVerifier } from "@/lib/server/retail-verifier";
import { runPurchaseSaleTransaction } from "@/lib/server/storage";
import { createPhysicalEnrollmentRecord } from "@/lib/server/enrollment-service";
import { buildPhysicalApplicationFingerprint } from "@/lib/server/application-guard";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const summary = (session: PhysicalStoreSessionRecord) => ({
  id: session.session_id, storeName: session.store_name, storeId: session.store_id,
  expiresAt: session.expires_at, amountMinor: session.purchase_sale!.amount_minor,
  currency: session.purchase_sale!.currency, paid: Boolean(session.purchase_sale!.paid_at),
  verified: session.clerk_verification.status === "verified", status: session.status,
  claimed: Boolean(session.enrollment_id)
});

export async function startPurchaseSale(storeId: string, verifierToken?: string) {
  const verifier = authenticateRetailVerifier(verifierToken, storeId);
  const store = getStoreById(storeId);
  if (!store || store.id !== verifier.retailer_id) throw new Error("Choose a valid store.");
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const session: PhysicalStoreSessionRecord = {
    session_id: randomId("store"), store_id: store.id, store_name: store.name,
    location_id: verifier.location_id, entry_mode: "retail_card", created_at: now, updated_at: now,
    expires_at: new Date(Date.now() + runtimeConfig.physicalSessionTtlSeconds * 1000).toISOString(),
    status: "open", clerk_verification: { status: "pending" }, device_auth: { status: "pending" },
    purchase_sale: { token_hash: hash(token), amount_minor: runtimeConfig.passIssuancePriceMinor, currency: runtimeConfig.deviceExtensionCurrency }
  };
  return runPurchaseSaleTransaction((data) => {
    data.physical_sessions.push(session);
    return { ...summary(session), token };
  });
}

export async function updatePurchaseSale(input: {
  sessionId: string; storeId: string; verifierToken?: string;
  action: "status" | "confirm_id" | "reject" | "confirm_payment" | "renew";
  method?: "cash" | "retail_till";
}) {
  const verifier = authenticateRetailVerifier(input.verifierToken, input.storeId);
  return runPurchaseSaleTransaction((data) => {
    const session = data.physical_sessions.find((s) => s.session_id === input.sessionId);
    if (!session?.purchase_sale || session.store_id !== verifier.retailer_id) throw new Error("Sale not found for this store.");
    if (input.action === "status") return summary(session);
    if (session.enrollment_id) throw new Error("This sale has already been claimed.");
    if (session.status === "rejected" || session.status === "cancelled") throw new Error("This sale was stopped.");
    if (input.action === "renew") {
      if (!session.purchase_sale.paid_at || session.clerk_verification.status !== "verified") throw new Error("Only a verified, paid sale can receive a replacement QR.");
      const token = randomBytes(32).toString("base64url");
      session.purchase_sale.token_hash = hash(token);
      session.expires_at = new Date(Date.now() + runtimeConfig.physicalSessionTtlSeconds * 1000).toISOString();
      session.status = "open";
      session.updated_at = new Date().toISOString();
      return { ...summary(session), token };
    }
    if (Date.parse(session.expires_at) <= Date.now()) throw new Error("This sale has expired. Do not collect payment; start a new sale.");
    const now = new Date().toISOString();
    if (input.action === "confirm_id") {
      session.clerk_verification = { status: "verified", checked_at: now, checked_by: verifier.verifier_id,
        verifier_id: verifier.verifier_id, retailer_id: verifier.retailer_id, verification_method: "physical_id_check" };
      session.attestation = { session_id: session.session_id, over_18: true, verification_method: "physical_id_check",
        verifier_id: verifier.verifier_id, retailer_id: verifier.retailer_id, location_id: verifier.location_id, verified_at: now };
    } else if (input.action === "reject") {
      if (session.purchase_sale.paid_at) throw new Error("Payment is already recorded. Resolve this sale at the till.");
      session.status = "rejected";
      session.clerk_verification.status = "rejected";
    } else if (input.action === "confirm_payment") {
      if (session.clerk_verification.status !== "verified") throw new Error("Confirm the ID check before taking payment.");
      if (input.method !== "cash" && input.method !== "retail_till") throw new Error("Select cash or card at the till.");
      if (!session.purchase_sale.paid_at) {
        session.purchase_sale.paid_at = now;
        session.purchase_sale.paid_by = verifier.verifier_id;
        session.purchase_sale.payment_method = input.method;
        // Give the customer the full activation window after payment.
        session.expires_at = new Date(Date.now() + runtimeConfig.physicalSessionTtlSeconds * 1000).toISOString();
      }
    }
    session.updated_at = now;
    return summary(session);
  });
}

export async function claimPurchaseSale(token: string, holderPublicKey: JsonWebKey): Promise<EnrollmentRecord> {
  if (!token || token.length > 128) throw new Error("Scan the activation QR from the clerk.");
  if (!holderPublicKey || holderPublicKey.d || holderPublicKey.kty !== "OKP" || holderPublicKey.crv !== "Ed25519") throw new Error("A valid device public key is required.");
  createPublicKey({ key: holderPublicKey as NodeJsonWebKey, format: "jwk" });
  return runPurchaseSaleTransaction((data) => {
    const session = data.physical_sessions.find((s) => s.purchase_sale?.token_hash === hash(token));
    if (!session?.purchase_sale) throw new Error("Activation link not found. Ask the clerk for your QR.");
    const sale = session.purchase_sale;
    const fingerprint = buildPhysicalApplicationFingerprint({ sessionId: session.session_id, holderPublicKey });
    if (session.enrollment_id) {
      const existing = data.enrollments.find((e) => e.id === session.enrollment_id);
      if (!existing || existing.application_fingerprint !== fingerprint) throw new Error("This pass has already been claimed on another device.");
      return existing;
    }
    if (Date.parse(session.expires_at) <= Date.now()) throw new Error("This activation link has expired. Ask the clerk for help; do not pay again.");
    if (session.status !== "open" || !sale.paid_at || session.clerk_verification.status !== "verified") throw new Error("The clerk must confirm your ID and payment before activation.");
    const now = new Date().toISOString();
    const record = createPhysicalEnrollmentRecord({
      createdAt: now, application: { bank_name: "In-store verification", submitted_at: now, lane: "physical", physical_context: session },
      holderPublicKey, applicationFingerprint: fingerprint, duplicateState: { blocked: false, checked_at: now }, session
    });
    record.physical_verification!.clerk_verification = session.clerk_verification;
    record.physical_verification!.attestation = session.attestation;
    record.physical_verification!.status = "awaiting_device_auth";
    record.status = "device_auth_pending";
    record.last_user_message = "Your ID and payment are confirmed. Finish setting up this device to receive your pass.";
    session.enrollment_id = record.id;
    session.user_code = record.physical_verification!.user_code.value;
    session.user_code_expires_at = record.physical_verification!.user_code.expires_at;
    session.status = "awaiting_device_auth";
    session.updated_at = now;
    const platformShare = Math.round(sale.amount_minor * runtimeConfig.platformSharePercent / 100);
    const payment: PaymentRecord = {
      payment_id: randomId("pay"), idempotency_key: `purchase:${session.session_id}`, enrollment_id: record.id,
      store_id: session.store_id, purpose: "pass_issuance", method: sale.payment_method === "cash" ? "cash_in_store" : "retail_till", amount_minor: sale.amount_minor,
      currency: sale.currency, status: "confirmed", created_at: sale.paid_at, confirmed_at: sale.paid_at,
      confirmed_by: sale.paid_by, platform_share_minor: platformShare, store_share_minor: sale.amount_minor - platformShare,
      settlement_status: "unsettled"
    };
    data.enrollments.push(record);
    data.payments.push(payment);
    return record;
  });
}
