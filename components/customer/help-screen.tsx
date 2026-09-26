"use client";


import { TicketCreate } from "@/components/customer/support/ticket-create";
import { Card, SectionHeading } from "@/components/customer/ui";




const ACCEPTED_ID = [
  "UK or EU passport",
  "UK or EU photocard driving licence",
  "PASS-accredited proof-of-age card (e.g. CitizenCard, Validate UK)",
  "Biometric residence permit"
];

const FAQ = [
  {
    q: "I lost both my phone and Zik Card.",
    a: "Open /account-recovery/restore on your replacement device. If you saved a 24-word recovery phrase and enabled a backup, you can restore from it. Never put those words in a help ticket. Without a phrase or usable backup, support can explain fresh verification but cannot decrypt the lost Vault."
  },
  {
    q: "Can I get ZikPass online?",
    a: "Digital Zik Pass starts with an in-person check: 99p one-off, free during Early Access. Physical Zik Cards cost £2.99 and are kept for life. The separate £3.99 remote finance-check route is coming later."
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

export function HelpScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-77c96c1e782b-2" : undefined}>Help</h1>
        <p className="mt-1 text-[14px] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-77c96c1e782b-3" : undefined}>
          How Zik Pass works and what to do when something goes wrong.
        </p>
      </div>

      <section id="contact-support" className="scroll-mt-20" aria-label="Contact support">
        <TicketCreate />
      </section>

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
            Check the participating store’s accepted-ID policy before visiting.
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

            Early Access includes a payment and finance-check preview. No real payment or finance check takes place. Confirmed partner locations will be listed before launch.
          </p>

        </Card>
      </section>
    </div>
  );
}
