"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { financeCheckGateway, financeStatus, type FinanceApplication } from "@/lib/client/finance-check";
import { Button, ButtonLink, Card, Sheet, StatusBadge } from "./ui";
import { ZikPassCard } from "./zik-pass-card";

export function FinanceCheckPreview({ compact = false }: { compact?: boolean }) {
  const [record, setRecord] = useState<FinanceApplication | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [consent, setConsent] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [method, setMethod] = useState("wallet");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const closePayment = useCallback(() => { if (!busy) setCheckoutOpen(false); }, [busy]);
  useEffect(() => {
    try { setRecord(financeCheckGateway.load()); }
    catch { setError("Allow storage on this device to save your pass, then try again."); }
    setLoaded(true);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function checkout() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { setRecord(await financeCheckGateway.checkout()); setNow(Date.now()); setCheckoutOpen(false); }
    catch { setError("Your progress could not be saved. No payment was taken. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!loaded || (compact && !record)) return null;
  const approved = record && financeStatus(record, now) === "approved";
  const checking = record && now < record.paidAt + 3000;
  return <Card className="!rounded-3xl p-6 space-y-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{record ? "Finance-check preview" : "Zik Pass via Finance Check"}</h2><StatusBadge tone="info">Coming Soon</StatusBadge></div>
    <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-1" : undefined}>Separate remote route · No charge or real finance check.</p>
    <ol aria-label="Pass progress" className="grid grid-cols-4 gap-2 text-center text-xs">
      {["Payment", "Check", "Pending", "Wallet"].map((label, index) => <li key={label} aria-current={index === (approved ? 3 : record ? checking ? 1 : 2 : 0) ? "step" : undefined} className={`border-t-4 pt-3 ${index <= (approved ? 3 : record ? checking ? 1 : 2 : 0) ? "border-[#28623c] font-bold" : "border-[var(--zk-line)] text-[var(--zk-text-faint)]"}`}>{label}</li>)}
    </ol>
    {record ? <>
      {approved ? <ZikPassCard digital /> : <div className="flex justify-center py-6"><span aria-hidden="true" className="text-5xl">{checking ? "◌" : "◷"}</span></div>}
      <div role="status" className="space-y-2"><h3 className="text-2xl font-bold">{approved ? "Approved. In your wallet." : checking ? "Checking your application…" : "Your pass is on its way"}</h3><p className="text-sm text-[var(--zk-text-soft)]">{approved ? "Your preview pass is saved on this device. Live verification is coming soon." : checking ? "Confirming the payment and age-check steps." : "Cooling-off period. You can leave this page and come back."}</p></div>
      {!approved && !checking ? <p className="text-sm">Preview ready in {Math.max(0, Math.ceil((record.readyAt - now) / 1000))}s</p> : null}
      <details className="text-sm"><summary className="cursor-pointer py-2 font-semibold">About this pass</summary><p className="pt-2 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-2" : undefined}>This is a saved preview, not proof of age. It cannot be used at partner websites or stores. The preview cooling-off period is shortened to 30 seconds; live timing and provider terms will be shown before purchase.</p></details>
      {!compact ? <ButtonLink href="/wallet" size="lg">Open wallet</ButtonLink> : null}
    </> : <>
      <div className="rounded-2xl bg-[var(--zk-sunken)] p-5"><div className="flex justify-between"><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-3" : undefined}>ZikPass · Finance check</span><strong data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-4" : undefined}>£3.99</strong></div><p className="mt-2 text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-5" : undefined}>One-off launch price · £0 charged today</p></div>
      <label className="flex gap-3 text-sm leading-relaxed"><input className="mt-1 h-5 w-5 shrink-0 accent-[#28623c]" type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} />I understand this preview uses no personal information and does not verify my age.</label>
      <Button size="lg" disabled={!consent} loading={busy} onClick={() => setCheckoutOpen(true)}>Continue to payment</Button>
      <details className="text-sm"><summary className="cursor-pointer py-2 font-semibold">How the finance check works</summary><div className="space-y-3 pt-2 text-[var(--zk-text-soft)]"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-6" : undefined}>At launch, a named provider will check identity and age against credit-reference records. You will see their privacy notice and authorise the check before sharing any details. A good credit score is not required.</p><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-7" : undefined}>Insufficient history or a mismatch is not an under-18 result. A failed check will not issue a pass, and a review route will be available. Provider integration and assurance review are still pending.</p><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-8" : undefined}>Acceptance depends on each website. ZikPass is not photo ID. Vault storage is available separately in Early Access; remote passport verification is coming soon.</p><ButtonLink href="/help/policy" variant="ghost">Privacy & terms</ButtonLink></div></details>
    </>}
    <Sheet open={checkoutOpen} onClose={closePayment} title="Confirm payment">
      <div className="space-y-5">
        <StatusBadge tone="info">Test payment · £0 charged</StatusBadge>
        <div className="text-center py-4"><p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-9" : undefined}>Zik Pass via Finance Check</p><p className="mt-2 text-4xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-10" : undefined}>£3.99</p><p className="mt-2 text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-11" : undefined}>One payment. No subscription.</p></div>
        <fieldset disabled={busy} className="space-y-2"><legend className="mb-3 text-sm font-semibold">Payment method</legend>{[["wallet", "Apple Pay", "Payment preview · Not connected"], ["google", "Google Pay", "Payment preview · Not connected"], ["card", "Card via Stripe", "Payment preview · No card details needed"]].map(([id, title, detail]) => <label key={id} className="flex items-center gap-3 rounded-2xl border border-[var(--zk-line)] p-4"><input type="radio" name="payment-method" value={id} checked={method === id} onChange={() => setMethod(id)} className="h-5 w-5 accent-[#28623c]" /><span><strong className="block text-sm">{title}</strong><span className="text-xs text-[var(--zk-text-soft)]">{detail}</span></span></label>)}</fieldset>
        <Button size="lg" loading={busy} onClick={() => void checkout()}>Confirm test payment</Button>
        <p className="text-center text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-12" : undefined}>Stripe, Apple Pay and Google Pay are not connected. No funds move.</p>
        {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      </div>
    </Sheet>
    {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
  </Card>;
}
