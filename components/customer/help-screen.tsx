"use client";

import { useState } from "react";
import { Button, Card, SectionHeading } from "@/components/customer/ui";
import { environmentBadgeLabel, isDemoEnvironment } from "@/lib/shared/demo-environment";

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
    a: "Codes expire after a few minutes. Start the in-store step again from My pass and show the clerk the fresh code."
  }
];

function DemoResetRow() {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");
  if (!isDemoEnvironment) return null;
  return (
    <div className="mt-3 border-t border-[var(--zk-line)] pt-3">
      <p className="text-[13px] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-77c96c1e782b-1" : undefined}>
        Reset the demo to a clean slate before a walkthrough. Clears all in-progress
        enrolments, store sessions and test payments on the server. Delete this
        device&rsquo;s pass separately from the My pass tab.
      </p>
      <Button
        variant="secondary"
        className="mt-2.5"
        loading={state === "working"}
        onClick={async () => {
          setState("working");
          try {
            await fetch("/api/demo/reset", { method: "POST" });
            setState("done");
          } catch {
            setState("idle");
          }
        }}
      >
        {state === "done" ? "Demo reset" : "Reset demo data"}
      </Button>
    </div>
  );
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
