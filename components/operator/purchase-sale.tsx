"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { OperatorShell } from "@/components/operator/operator-shell";
import { Alert, Button, ButtonLink, Card } from "@/components/customer/ui";

type Sale = { product?: "digital_voucher" | "physical_card"; customerConnected?: boolean; id: string; token?: string; storeName: string; expiresAt: string; amountMinor: number; currency: string; paid: boolean; verified: boolean; claimed: boolean; status: string };
export function PurchaseSale({ storeId }: { storeId: string }) {
  return <OperatorShell title="Sell a Zik Pass" storeId={storeId}><PurchaseSaleForm storeId={storeId} /></OperatorShell>;
}
function PurchaseSaleForm({ storeId }: { storeId: string }) {
  const [product, setProduct] = useState("digital_voucher");
  const [connectionError, setConnectionError] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState("cash");
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const storageKey = `zik-purchase-sale:${storeId}`;
  useEffect(() => {
    try { const saved = sessionStorage.getItem(storageKey); if (saved) setSale(JSON.parse(saved)); } catch { /* storage optional */ }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [storageKey]);
  useEffect(() => {
    if (!sale?.paid || !sale.token) return;
    let active = true;
    const link = `${window.location.origin}/${sale.product === "digital_voucher" ? "dashboard/customer/activate" : "card"}#activate=${encodeURIComponent(sale.token)}`;
    setUrl(link);
    void QRCode.toDataURL(link, { width: 320, margin: 2 }).then((image) => { if (active) setQr(image); }).catch(() => setError("Could not draw the QR. Use the activation link instead."));
    return () => { active = false; };
  }, [sale?.paid, sale?.token, sale?.product]);
  const saleId = sale?.id;
  const salePaid = sale?.paid;
  const saleClaimed = sale?.claimed;
  const saleExpiry = sale?.expiresAt;
  useEffect(() => {
    if (!saleId || !salePaid || saleClaimed || !saleExpiry || Date.parse(saleExpiry) <= Date.now()) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch("/api/purchase-sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", sessionId: saleId }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) {
          setConnectionError("");
          setSale(previous => {
            if (!previous || previous.id !== data.id) return previous;
            const next = { ...previous, ...data };
            try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* optional */ }
            return next;
          });
        }
      } catch { if (active) setConnectionError("Progress updates paused. Check your connection or sign in again."); }
      if (active) timer = setTimeout(poll, 2500);
    }
    void poll();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [saleId, salePaid, saleClaimed, saleExpiry, storageKey]);
  async function action(action: string) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/purchase-sale", { method: "POST", headers: { "Content-Type": "application/json", "x-zik-store-id": storeId }, body: JSON.stringify({ action, sessionId: sale?.id, method, product }) });
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
  const reset = () => { setSale(null); setQr(""); setUrl(""); setError(null); setConnectionError(""); try { sessionStorage.removeItem(storageKey); } catch { /* optional */ } };
  return <div className="space-y-4">
    <ButtonLink href="/dashboard" variant="ghost">← Dashboard</ButtonLink>
    <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-1" : undefined}>Purchase card → check ID → take payment → hand over activation QR.</p>
    <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-2" : undefined}>Demo terminal. Payment records represent money taken at the till; this screen does not charge a card.</p>
    {connectionError && <Alert tone="caution">{connectionError}</Alert>}
    {error && <Alert tone="critical">{error}</Alert>}
    {!sale ? <Card className="space-y-4 p-5"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-3" : undefined}>Customer brought a Zik purchase card to the till? Start their sale here. They do not need their phone yet.</p><label className="block text-sm font-semibold">Product<select className="mt-2 block w-full rounded-[5px] border p-3" value={product} onChange={event => setProduct(event.target.value)}><option value="digital_voucher">Digital ZikPass · single-use voucher</option><option value="physical_card">Physical Zik Card · £2.99</option></select></label><Button loading={busy} onClick={() => void action("start")}>Start sale</Button><ButtonLink href="/dashboard/store/verify" variant="secondary">Customer already has a verification code</ButtonLink></Card>
    : sale.status === "rejected" ? <Card className="space-y-4 p-5"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-4" : undefined}>ID not verified. Do not take payment or issue a pass.</p><Button onClick={reset}>Next customer</Button></Card>
    : sale.claimed ? <Card className="space-y-4 p-5"><p>{sale.status === "completed" ? "Pass issued to the customer’s device." : "Claimed on the customer’s device. They can finish setup on their phone."}</p><Button onClick={reset}>Next customer</Button></Card>
    : expired ? <Alert tone="caution" title="Session expired"><p>{sale.paid ? "Payment is recorded. With the same customer still at the till, replace the expired QR without charging again." : "No payment recorded. Start a fresh sale."}</p>{sale.paid ? <Button loading={busy} onClick={() => void action("renew")}>Replace activation QR — no payment</Button> : <Button onClick={reset}>Start again</Button>}</Alert>
    : !sale.verified ? <Card className="space-y-4 p-5"><h2 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-5" : undefined}>1. Check photo ID</h2><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-6" : undefined}>Confirm the customer is 18 or over. Inspect their ID in person; do not photograph or upload it.</p><Button loading={busy} onClick={() => void action("confirm_id")}>ID checked — confirm 18+</Button><Button variant="danger" disabled={busy} onClick={() => void action("reject")}>Cannot verify</Button></Card>
    : !sale.paid ? <Card className="space-y-4 p-5"><h2 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-7" : undefined}>2. Confirm at the till</h2><p>{sale.amountMinor === 0 ? "Free during early access. No payment needed." : <>ID confirmed. Collect {new Intl.NumberFormat("en-GB", { style: "currency", currency: sale.currency }).format(sale.amountMinor / 100)} at the till.</>}</p><label className="block">Payment method<select className="mt-2 block w-full rounded-xl border p-3" value={method} onChange={(event) => setMethod(event.target.value)}><option value="cash">Cash</option><option value="retail_till">Card at the till</option></select></label><Button loading={busy} onClick={() => void action("confirm_payment")}>{sale.amountMinor === 0 ? "Continue — show QR" : "Payment received — show QR"}</Button></Card>
    : <Card className="space-y-4 p-5"><h2 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-8" : undefined}>3. Connect the customer’s phone</h2><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-9" : undefined}>Ask the customer to scan this QR using their phone’s Camera.</p>{sale.product === "digital_voucher" && <div role="status" aria-live="polite" className="rounded-[5px] bg-[var(--zk-sunken)] p-4"><p className="font-bold">{sale.customerConnected ? "Customer connected" : "Waiting for customer to scan…"}</p><p className="mt-1 text-sm">{sale.customerConnected ? "The activation page has been opened. This does not confirm device ownership or issue a pass." : "This updates automatically when the customer opens the QR link."}</p></div>}
      {url && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) && <Alert tone="caution">This QR points to this Mac only. Open this terminal using the Mac’s Wi-Fi address or your HTTPS tunnel address before scanning.</Alert>}
      {qr && <Image src={qr} alt="Scan to connect to your ZikPass session" width={320} height={320} className="mx-auto rounded-none" unoptimized />}<p className="text-center text-sm">Activation window: {Math.max(0, Math.ceil((Date.parse(sale.expiresAt) - now) / 60000))} minutes remaining</p><a className="block text-center underline" href={url} target="_blank" rel="noreferrer" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-10" : undefined}>Open activation link (same-device demo)</a><Button loading={busy} onClick={() => void action("status")}>Check customer progress</Button><p className="text-xs" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d3d24a6cee7c-11" : undefined}>This private QR is for this customer only. Refreshing this terminal keeps the current sale.</p></Card>}
  </div>;
}
