import type { Route } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink, Card } from "@/components/customer/ui";
import { CheckIcon } from "@/components/customer/icons";

export const metadata = {
  title: "Zik Pass card",
  description: "Activate a Zik Pass card you bought in store."
};

// Target for the QR printed on a physical Zik Pass card (a prepaid retail item).
export default function CardActivationPage() {
  return (
    <CustomerShell active="home" back={{ href: "/home" as Route, label: "Home" }}>
      <div className="space-y-4">
        <header>
          <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]">
            Activate your Zik Pass card
          </h1>
          <p className="mt-1 text-[14px] text-[var(--zk-text-soft)]">
            You bought this card at a till, so it&rsquo;s already paid for.
          </p>
        </header>

        <Card className="p-4">
          <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--zk-text-faint)]">
            To finish
          </p>
          <ul className="mt-2 space-y-2 text-[14px] text-[var(--zk-text)]">
            {[
              "Bring photo ID (passport, driving licence or PASS card)",
              "Show your code and ID to a clerk at the same store",
              "Your pass is saved to this phone - no extra payment"
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--zk-positive)]" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <ButtonLink href={"/find?entry=retail_card" as Route} size="lg">
          Choose your store
        </ButtonLink>

        <p className="px-1 text-[12px] leading-relaxed text-[var(--zk-text-faint)]">
          No card? You can also get a Zik Pass at the counter -{" "}
          <a href="/find" className="underline">find a store</a>.
        </p>
      </div>
    </CustomerShell>
  );
}
