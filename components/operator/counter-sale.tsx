"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { OperatorShell, useOperatorStore } from "@/components/operator/operator-shell";
import { Alert, Button, ButtonLink, Card } from "@/components/customer/ui";

type Sale = { id: string; token?: string; storeName: string; expiresAt: string; amountMinor: number; currency: string; paid: boolean; verified: boolean; claimed: boolean; status: string };
export function CounterSale() {
  const [storeId, setStoreId] = useOperatorStore();
  return <OperatorShell title="Sell a Zik Pass" storeId={storeId} onStoreChange={setStoreId}><CounterSaleForm key={storeId} storeId={storeId} /></OperatorShell>;
}
function CounterSaleForm({ storeId }: { storeId: string }) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState("cash");
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const storageKey = `zik-counter-sale:${storeId}`;
  useEffect(() => {
    try { const saved = sessionStorage.getItem(storageKey); if (saved) setSale(JSON.parse(saved)); } catch { /* storage optional */ }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [storageKey]);
  useEffect(() => {
    if (!sale?.paid || !sale.token) return;
    let active = true;
    const link = `${window.location.origin}/card#activate=${encodeURIComponent(sale.token)}`;
    setUrl(link);
    void QRCode.toDataURL(link, { width: 320, margin: 2 }).then((image) => { if (active) setQr(image); }).catch(() => setError("Could not draw the QR. Use the activation link instead."));
    return () => { active = false; };
  }, [sale?.paid, sale?.token]);
  async function action(action: string) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/counter-sale", { method: "POST", headers: { "Content-Type": "application/json", "x-zik-retailer-token": "demo-retail-terminal", "x-zik-store-id": storeId }, body: JSON.stringify({ action, sessionId: sale?.id, method }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const next = { ...data, token: data.token ?? sale?.token } as Sale;
      setSale(next);
      setNow(Date.now());
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage optional */ }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Please retry."); }
    finally { setBusy(false); }
  }
  const expired = sale && Date.parse(sale.expiresAt) <= now;
  const reset = () => { setSale(null); setQr(""); setUrl(""); setError(null); try { sessionStorage.removeItem(storageKey); } catch { /* optional */ } };
  return <div className="space-y-4">
    <p className="text-sm">Purchase card → check ID → take payment → hand over activation QR.</p>
    <p className="text-xs text-[var(--zk-text-soft)]">Demo terminal. Payment records represent money taken at the till; this screen does not charge a card.</p>
    {error && <Alert tone="critical">{error}</Alert>}
    {!sale ? <Card className="space-y-4 p-5"><p>Customer brought a Zik purchase card to the till? Start their sale here. They do not need their phone yet.</p><Button loading={busy} onClick={() => void action("start")}>Start counter sale</Button><ButtonLink href="/verify" variant="secondary">Customer already has a verification code</ButtonLink></Card>
    : sale.status === "rejected" ? <Card className="space-y-4 p-5"><p>ID not verified. Do not take payment or issue a pass.</p><Button onClick={reset}>Next customer</Button></Card>
    : sale.claimed ? <Card className="space-y-4 p-5"><p>{sale.status === "completed" ? "Pass issued to the customer’s device." : "Claimed on the customer’s device. They can finish setup on their phone."}</p><Button onClick={reset}>Next customer</Button></Card>
    : expired ? <Alert tone="caution" title="Session expired"><p>{sale.paid ? "Payment is recorded. With the same customer still at the till, replace the expired QR without charging again." : "No payment recorded. Start a fresh sale."}</p>{sale.paid ? <Button loading={busy} onClick={() => void action("renew")}>Replace activation QR — no payment</Button> : <Button onClick={reset}>Start again</Button>}</Alert>
    : !sale.verified ? <Card className="space-y-4 p-5"><h2 className="font-bold">1. Check photo ID</h2><p>Confirm the customer is 18 or over. Inspect their ID in person; do not photograph or upload it.</p><Button loading={busy} onClick={() => void action("confirm_id")}>ID checked — confirm 18+</Button><Button variant="danger" disabled={busy} onClick={() => void action("reject")}>Cannot verify</Button></Card>
    : !sale.paid ? <Card className="space-y-4 p-5"><h2 className="font-bold">2. Take payment</h2><p>ID confirmed. Collect {new Intl.NumberFormat("en-GB", { style: "currency", currency: sale.currency }).format(sale.amountMinor / 100)} at the till.</p><label className="block">Payment method<select className="mt-2 block w-full rounded-xl border p-3" value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Cash</option><option value="retail_till">Card at the till</option></select></label><Button loading={busy} onClick={() => void action("confirm_payment")}>Payment received — show QR</Button></Card>
    : <Card className="space-y-4 p-5"><h2 className="font-bold">3. Customer scans to receive their pass</h2><p>ID and payment confirmed. Ask this customer to scan the QR on their own phone, then choose “Save my Zik Pass”.</p>{qr && <Image src={qr} alt="Scan to activate your paid Zik Pass" width={320} height={320} className="mx-auto rounded-2xl" unoptimized />}<p className="text-center text-sm">Activation window: {Math.max(0, Math.ceil((Date.parse(sale.expiresAt) - now) / 60000))} minutes remaining</p><a className="block text-center underline" href={url} target="_blank" rel="noreferrer">Open activation link (same-device demo)</a><Button loading={busy} onClick={() => void action("status")}>Check customer progress</Button><p className="text-xs">This private QR is for this customer only. Refreshing this terminal keeps the current sale.</p></Card>}
  </div>;
}
