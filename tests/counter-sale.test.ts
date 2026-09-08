import { describe, it, expect } from "vitest";
import { startCounterSale, updateCounterSale, claimCounterSale } from "@/lib/server/counter-sale";
import { generateKeyPair } from "@/lib/shared/crypto/ed25519";
import { completePhysicalDeviceAuth, startPhysicalDeviceAuth, startEnrollment } from "@/lib/server/enrollment-service";
import { runCounterSaleTransaction } from "@/lib/server/storage";
import { getPaymentsForEnrollment } from "@/lib/server/payments";
const clerk = { storeId: "zik-london-001", verifierToken: "demo-retail-terminal" };
async function paidSale() {
  const sale = await startCounterSale(clerk.storeId, clerk.verifierToken);
  await updateCounterSale({ ...clerk, sessionId: sale.id, action: "confirm_id" });
  await updateCounterSale({ ...clerk, sessionId: sale.id, action: "confirm_payment", method: "cash" });
  return sale;
}

describe("clerk-first counter sale", () => {
  it("requires clerk authorisation and the correct store", async () => {
    await expect(startCounterSale(clerk.storeId)).rejects.toThrow("authorised");
    const sale = await startCounterSale(clerk.storeId, clerk.verifierToken);
    await expect(updateCounterSale({ ...clerk, storeId: "zik-london-002", sessionId: sale.id, action: "confirm_id" })).rejects.toThrow();
  });
  it("blocks payment before ID and activation before payment", async () => {
    const sale = await startCounterSale(clerk.storeId, clerk.verifierToken);
    const key = (await generateKeyPair()).publicKeyJwk;
    await expect(updateCounterSale({ ...clerk, sessionId: sale.id, action: "confirm_payment", method: "cash" })).rejects.toThrow("ID check");
    await updateCounterSale({ ...clerk, sessionId: sale.id, action: "confirm_id" });
    await expect(claimCounterSale(sale.token, key)).rejects.toThrow("payment");
  });
  it("issues after payment and customer device setup, with one ledger entry", async () => {
    const sale = await paidSale();
    const key = (await generateKeyPair()).publicKeyJwk;
    const record = await claimCounterSale(sale.token, key);
    expect(record.status).toBe("device_auth_pending");
    expect(record.physical_verification?.attestation?.over_18).toBe(true);
    const payments = await getPaymentsForEnrollment(record.id);
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: "confirmed", method: "cash_in_store" });
    const challenge = await startPhysicalDeviceAuth(record.id);
    const issued = await completePhysicalDeviceAuth({ enrollmentId: record.id, challengeId: challenge.challenge_id, method: "demo_device_check" });
    expect(issued.status).toBe("issued");
    expect(issued.issued_credential?.payload.subject_public_key).toEqual(key);
  });
  it("makes parallel retries idempotent and rejects a second device", async () => {
    const sale = await paidSale();
    const key = (await generateKeyPair()).publicKeyJwk;
    const [a, b] = await Promise.all([claimCounterSale(sale.token, key), claimCounterSale(sale.token, key)]);
    expect(a.id).toBe(b.id);
    expect(await getPaymentsForEnrollment(a.id)).toHaveLength(1);
    await expect(claimCounterSale(sale.token, (await generateKeyPair()).publicKeyJwk)).rejects.toThrow("another device");
  });
  it("does not allow the generic enrollment endpoint to bypass the private QR", async () => {
    const sale = await paidSale();
    await expect(startEnrollment({ application: { lane: "physical", bank_name: "In-store", submitted_at: new Date().toISOString(), physical_context: { session_id: sale.id, store_id: clerk.storeId, store_name: sale.storeName, location_id: "front-desk", entry_mode: "retail_card" } }, holderPublicKey: (await generateKeyPair()).publicKeyJwk, applicationFingerprint: "bypass" })).rejects.toThrow("private activation QR");
  });
  it("replaces an expired paid QR without taking another payment", async () => {
    const sale = await paidSale();
    await runCounterSaleTransaction((data) => { data.physical_sessions.find(s => s.session_id === sale.id)!.expires_at = "2000-01-01T00:00:00Z"; });
    const key = (await generateKeyPair()).publicKeyJwk;
    await expect(claimCounterSale(sale.token, key)).rejects.toThrow("expired");
    const replacement = await updateCounterSale({ ...clerk, sessionId: sale.id, action: "renew" });
    expect(replacement.paid).toBe(true);
    await expect(claimCounterSale(sale.token, key)).rejects.toThrow("not found");
    const record = await claimCounterSale((replacement as { token: string }).token, key);
    expect(await getPaymentsForEnrollment(record.id)).toHaveLength(1);
  });
  it("cannot activate or charge a rejected sale", async () => {
    const sale = await startCounterSale(clerk.storeId, clerk.verifierToken);
    await updateCounterSale({ ...clerk, sessionId: sale.id, action: "reject" });
    await expect(updateCounterSale({ ...clerk, sessionId: sale.id, action: "confirm_payment", method: "cash" })).rejects.toThrow("stopped");
    await expect(claimCounterSale(sale.token, (await generateKeyPair()).publicKeyJwk)).rejects.toThrow();
  });
});
