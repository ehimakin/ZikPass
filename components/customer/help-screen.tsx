"use client";

import { useState } from "react";
import { Alert, Button, Card, SectionHeading } from "@/components/customer/ui";
import { environmentBadgeLabel, isDemoEnvironment } from "@/lib/shared/demo-environment";

import { resetDemoData } from "@/lib/client/demo-reset";

const ACCEPTED_ID = [
  "UK or EU passport",
  "UK or EU photocard driving licence",
  "PASS-accredited proof-of-age card (e.g. CitizenCard, Validate UK)",
  "Biometric residence permit"
];

const FAQ = [
  {
    q: "Why do I have to go to a store?",
    a: "The age check happens in person; the physical flow does not upload an ID photo. Your pass stays on your device, with operational issuance records on Zik servers."
  },
  {
    q: "What does a website learn about me?",
    a: "Age-only sites receive an over-18 result and verification metadata. Retail demos also receive only the self-entered profile fields you approve. No date of birth or document number is shared."
  },
  {
    q: "How long does my pass last?",
    a: "12 months from issue. You will see the expiry date on your pass. Renew at any store."
  },
  {
    q: "I got a new phone.",
    a: "Install Zik Pass on the new phone, then use the one-time transfer link from a device that still has your pass. Your pass covers 2 devices."
  },
  {
    q: "The clerk could not find my code.",
    a: "Codes expire after a few minutes. Start the in-store step again from Zik Pass in your Wallet and show the clerk the fresh code."
  }
];

function DemoResetRow() {
  const [state, setState] = useState<"idle" | "confirm" | "working" | "done">("idle");
  const [error, setError] = useState("");
  if (!isDemoEnvironment) return null;
  async function reset() {
    setState("working"); setError("");
    try { await resetDemoData(); setState("done"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Reset failed. Please try again."); setState("confirm"); }
  }
  return <div className="mt-3 space-y-3 border-t border-[var(--zk-line)] pt-3">
    <p className="text-[13px] text-[var(--zk-text-soft)]">Start a fresh walkthrough. Reset server demo records and this browser’s saved Pass, device keys, encrypted Vault, onboarding progress and demo sessions. This also signs you out of the clerk demo.</p>
    {state === "confirm" || state === "working" ? <>
      <Alert tone="caution" title="Delete demo data?">Your saved Vault details will be permanently deleted from this browser. Server demo records are shared, so this also resets other ongoing walkthroughs. Close other Zik tabs before continuing. Data saved in other browsers or devices is not erased.</Alert>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" loading={state === "working"} onClick={() => void reset()}>Delete and reset demo</Button>
        <Button variant="secondary" disabled={state === "working"} onClick={() => { setState("idle"); setError(""); }}>Cancel</Button>
      </div>
    </> : <Button variant="secondary" onClick={() => { setState("confirm"); setError(""); }}>Reset demo data</Button>}
    {error ? <p role="alert" className="text-sm text-[var(--zk-critical)]">{error}</p> : null}
    {state === "done" ? <p role="status" className="text-sm">Demo reset complete. This browser’s Wallet and Vault are empty. You can start again from Home.</p> : null}
  </div>;
}

export function HelpScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-77c96c1e782b-2" : undefined}>Help</h1>
        <p className="mt-1 text-[14px] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-77c96c1e782b-3" : undefined}>
          How Zik Pass works and what to do when something goes wrong.
        </p>
      </div>

      <section>
        <SectionHeading>Accepted ID</SectionHeading>
        <Card className="p-4">
          <ul className="space-y-2 text-[14px] text-[var(--zk-text)]">
            {ACCEPTED_ID.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--zk-text-faint)]" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-77c96c1e782b-4" : undefined}>
            Prototype guidance only. A production service would publish a definitive
            accepted-ID policy per region.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>Common questions</SectionHeading>
        <div className="space-y-2">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="rounded-[var(--zk-r-md)] border border-[var(--zk-line)] bg-[var(--zk-card)] px-4 py-3"
            >
              <summary className="cursor-pointer text-[14px] font-bold text-[var(--zk-text)]">
                {item.q}
              </summary>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--zk-text-soft)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading>About this build</SectionHeading>
        <Card className="p-4 text-[13px] leading-relaxed text-[var(--zk-text-soft)]">
          <p>
            <span className="font-semibold text-[var(--zk-text)]">{environmentBadgeLabel()}.</span>{" "}
            This is a working prototype. Payments are test-only, stores are fictional
            demo locations, and the identity check is a demonstration flow. It is not a
            certified age-verification service.
          </p>
          <DemoResetRow />
        </Card>
      </section>
    </div>
  );
}
