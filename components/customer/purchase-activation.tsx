"use client";
import { useEffect, useState } from "react";
import { ensureHolderKeyPair, storeEnrollmentContext } from "@/lib/client/wallet-client";
import type { EnrollmentRecord } from "@/lib/shared/types";
import type { PassPrice } from "@/lib/shared/payment-config";
import { Alert, Button, ButtonLink, Card } from "@/components/customer/ui";
import { OnboardingFlow } from "@/components/customer/onboarding/onboarding-flow";

export function PurchaseActivation({ price }: { price: PassPrice }) {
  const [token, setToken] = useState<string | null>(null);
  const [record, setRecord] = useState<EnrollmentRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setToken(new URLSearchParams(window.location.hash.slice(1)).get("activate") ?? "");
    read(); window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  async function claim() {
    if (busy || !token) return;
    setBusy(true); setError(null);
    try {
      const wallet = await ensureHolderKeyPair();
      if (wallet.credential) throw new Error("This device already has a pass. Open My pass or scan this QR on the intended customer’s device.");
      const response = await fetch("/api/purchase-sale/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, holderPublicKey: wallet.holderKeyPair?.publicKeyJwk }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await storeEnrollmentContext({ enrollmentId: data.id, enrollmentLane: "physical", physicalSessionId: data.physical_verification.session.session_id });
      setRecord(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save the pass. Please retry."); }
    finally { setBusy(false); }
  }
  if (record) return <OnboardingFlow price={price} initialEnrollment={record} storeId={record.physical_verification?.session.store_id} />;
  if (token === null) return <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-de7db1afb88b-1" : undefined}>Preparing activation…</p>;
  return <div className="space-y-5"><h1 className="text-2xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-de7db1afb88b-2" : undefined}>Activate your Zik Pass</h1>
    {error && <Alert tone="critical">{error}</Alert>}
    {token ? <Card className="space-y-4 p-5"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-de7db1afb88b-3" : undefined}>Use the QR your clerk showed after checking your ID and taking payment. Save the pass to this phone and complete the device setup.</p><p className="font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-de7db1afb88b-4" : undefined}>No further payment is needed.</p><Button loading={busy} onClick={() => void claim()}>Save my Zik Pass</Button><p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-de7db1afb88b-5" : undefined}>This prototype uses a demo device check. Keep the activation link private.</p></Card>
    : <Card className="space-y-4 p-5"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-de7db1afb88b-6" : undefined}>Bring your purchase card to the till. The clerk will check your photo ID, take payment, and show a private activation QR for your phone.</p><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-de7db1afb88b-7" : undefined}>Already paid? Scan the QR on the clerk’s screen. The printed purchase card alone does not activate a pass.</p><ButtonLink href="/find" variant="secondary">I&apos;m at the till</ButtonLink></Card>}
  </div>;
}
