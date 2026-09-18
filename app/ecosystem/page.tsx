import { CustomerShell } from "@/components/customer/customer-shell";
import { ProductFamily } from "@/components/customer/product-family";
import { Card, StatusBadge } from "@/components/customer/ui";
import { getPassPrice } from "@/lib/shared/payment-config";

export const metadata = {
  title: "The Zik ecosystem",
  description: "Zik Pass today, and the planned path to device-held credentials and selective sharing."
};

export default function EcosystemPage() {
  return (
    <CustomerShell active="about" title="The Zik ecosystem">
      <div className="space-y-6 pb-6">
        <section className="pt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-1" : undefined}>One principle. Three products.</p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-2" : undefined}>The Zik ecosystem</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-3" : undefined}>Zik separates verifying information from disclosing it. Start by proving your age. Later, keep more verified information on your device and share only what a situation actually requires.</p>
        </section>
        <p className="rounded-none bg-[var(--zk-sunken)] p-4 text-sm font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-4" : undefined}>ZikVault works on this device: you can store documents in it and have them read here. Zik ID is not available — you can prepare an application, but the identity checks behind it do not exist yet, so no ID can be issued.</p>
        <section aria-labelledby="products-title">
          <h2 id="products-title" className="mb-4 text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-5" : undefined}>Zik starts with Zik Pass.</h2>
          <ProductFamily price={getPassPrice().display} />
        </section>
        <Card as="section" className="p-5">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-6" : undefined}>Verify once. Choose what to disclose.</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-7" : undefined}>Verifying identity and disclosing identity are separate actions. Today, Zik Pass proves one attribute: you’re 18+. A participating site receives the minimum age assertion and verification metadata, without your name, exact date of birth, photograph, address or identity document.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-8" : undefined}>ZikVault now does part of this. Documents you choose are stored encrypted on this device, and Zik can read them here — on your device, never on a server — to suggest details you then review. Your documents are not uploaded to Zik or to an AI provider, and there is no central Zik identity-document database.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-9" : undefined}>Today the Vault reads passports, UK driving licences, bills and statements, certificates and contracts. What it finds is a suggestion, not a check: confirming that Zik read a document correctly is not the same as confirming the document is genuine or that it is yours. Nothing in your Vault is labelled verified, because nothing has been verified yet.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-10" : undefined}>When you have confirmed enough supporting information, the Vault offers to start a Zik ID application, explains exactly what is still missing, and saves the application on your device. That is as far as it goes: Zik has not yet defined who checks an identity or how, so nothing is sent, approved or issued. Zik ID would remain a presentation of Vault claims, not an independent profile or duplicate identity database.</p>
        </Card>
        <Card as="section" className="p-5">
          <StatusBadge>Illustrative example · Planned</StatusBadge>
          <h2 className="mt-3 text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-11" : undefined}>A car-hire request</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-12" : undefined}>An example of sharing only what a situation requires. This is an explanation, not a working sharing form.</p>
          <dl className="mt-4 divide-y divide-[var(--zk-line)] text-sm">
            {[["Legal name", "Shared"], ["Over 25", "Shared"], ["Valid driving entitlement", "Shared"], ["Exact DOB", "Not shared"], ["Home address", "Not shared"]].map(([claim, status]) => (
              <div key={claim} className="flex items-baseline justify-between gap-4 py-3"><dt>{claim}</dt><dd className="shrink-0 font-semibold">{status}</dd></div>
            ))}
          </dl>
        </Card>
        <p className="text-xs leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-13" : undefined}>Local-first does not mean Zik stores no data. Operational services may still hold public keys, status and revocation data, issuer metadata, fraud signals and audit events. The Vault&rsquo;s storage and on-device analysis decisions are recorded in ADR 007. Planned prices cannot be charged here, and Zik ID is not currently accepted as physical identification.</p>
      </div>
    </CustomerShell>
  );
}
