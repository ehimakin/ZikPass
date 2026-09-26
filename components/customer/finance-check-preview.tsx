"use client";

import { useState } from "react";
import { Button, ButtonLink, Card, StatusBadge } from "@/components/customer/ui";

type Outcome = "matched" | "unconfirmed" | "under18";
const outcomes: Record<Outcome, { title: string; detail: string }> = {
  matched: { title: "Sample: age and identity checks passed", detail: "In a live service, a successful provider result would lead to the £3.99 bundle payment and device-binding steps before issuance. ZikVault and passport verification when you add a scan are included in that price. No payment has been taken and no Zik Pass has been issued here." },
  unconfirmed: { title: "Sample: we could not confirm your age", detail: "Missing history or a mismatch is not an under-18 result. No pass would be issued. Try another verification route or request a review with the provider. Under the proposed flow, payment would not be requested." },
  under18: { title: "Sample: the age requirement was not met", detail: "An under-18 result would stop this application, with no payment or pass. An incorrect result would have a review route before any new decision." }
};

export function FinanceCheckPreview() {
  const [started, setStarted] = useState(false);
  const [authorised, setAuthorised] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>("matched");
  const [result, setResult] = useState<Outcome | null>(null);
  function reset() { setStarted(false); setAuthorised(false); setOutcome("matched"); setResult(null); }
  return (
    <section id="preview" className="scroll-mt-24" aria-labelledby="finance-preview-title">
      <Card className="!rounded-2xl p-5 space-y-4">
        <StatusBadge tone="info">Sample data only</StatusBadge>
        <h2 id="finance-preview-title" className="text-2xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-1" : undefined}>Try the remote flow</h2>
        <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-2" : undefined}>Explore the steps without entering personal or financial information. No credit agency is contacted.</p>
        {!started ? <Button onClick={() => setStarted(true)}>Start sample check</Button> : result ? <>
          <div role="status" className="space-y-3 rounded-xl bg-[var(--zk-sunken)] p-4">
            <h3 className="text-lg font-bold">{outcomes[result].title}</h3>
            <p className="text-sm leading-relaxed">{outcomes[result].detail}</p>
          </div>
          {result === "unconfirmed" ? <ButtonLink href="/find" variant="secondary">Find another route</ButtonLink> : null}
          <Button variant="secondary" onClick={reset}>Restart sample journey</Button>
        </> : <>
          <h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-3" : undefined}>1. Review the check</h3>
          <p className="text-sm leading-relaxed" data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-4" : undefined}>A live provider would receive your identity details to check your age and protect against someone using another adult’s records. The receiving website would not receive those details.</p>
          <label className="flex min-h-[44px] items-start gap-3 text-sm leading-relaxed"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={authorised} onChange={event => setAuthorised(event.target.checked)} />I understand this is a simulation of authorising a soft identity and age check, not consent to a real search.</label>
          <label className="block space-y-2 text-sm font-semibold"><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-60b6535820bd-5" : undefined}>2. Choose a sample provider response</span><select className="block min-h-[44px] w-full rounded-lg border border-[var(--zk-line)] bg-[var(--zk-card)] p-3" value={outcome} onChange={event => setOutcome(event.target.value as Outcome)}><option value="matched">18+ and identity safeguards passed</option><option value="unconfirmed">Insufficient history or identity mismatch</option><option value="under18">Under 18</option></select></label>
          <div className="flex flex-wrap gap-3"><Button disabled={!authorised} onClick={() => setResult(outcome)}>Show sample result</Button><Button variant="secondary" onClick={reset}>Cancel</Button></div>
        </>}
      </Card>
    </section>
  );
}
