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
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--zk-text-soft)]">One principle. Three products.</p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight">The Zik ecosystem</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]">Zik separates verifying information from disclosing it. Start by proving your age. Later, keep more verified information on your device and share only what a situation actually requires.</p>
        </section>
        <p className="rounded-[var(--zk-r-md)] bg-[var(--zk-sunken)] p-4 text-sm font-semibold">ZikVault and Zik ID are planned products and are not available in this prototype.</p>
        <section aria-labelledby="products-title">
          <h2 id="products-title" className="mb-4 text-xl font-bold">Zik starts with Zik Pass.</h2>
          <ProductFamily price={getPassPrice().display} />
        </section>
        <Card as="section" className="p-5">
          <h2 className="text-xl font-bold">Verify once. Choose what to disclose.</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]">Verifying identity and disclosing identity are separate actions. Today, Zik Pass proves one attribute: you’re 18+. A participating site receives the minimum age assertion and verification metadata, without your name, exact date of birth, photograph, address or identity document.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]">ZikVault is planned as a local-first pool of proof-backed credential objects. Credentials and underlying identity documents are designed to live on your device rather than in a central Zik identity-document database.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]">Future evidence could include a passport, driving licence, utility bill, designated verified photograph, address evidence, or student and professional credentials. You would choose which verified claims to combine for a request.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]">When enough verified information is available, an in-app offer could let you assemble Zik ID: a preset combining Vault claims such as verified name, photograph, age and identity-document status. It would not create an independent profile or duplicate identity database.</p>
        </Card>
        <Card as="section" className="p-5">
          <StatusBadge>Illustrative example · Planned</StatusBadge>
          <h2 className="mt-3 text-xl font-bold">A car-hire request</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]">An example of sharing only what a situation requires. This is an explanation, not a working sharing form.</p>
          <dl className="mt-4 divide-y divide-[var(--zk-line)] text-sm">
            {[["Legal name", "Shared"], ["Over 25", "Shared"], ["Valid driving entitlement", "Shared"], ["Exact DOB", "Not shared"], ["Home address", "Not shared"]].map(([claim, status]) => (
              <div key={claim} className="flex items-baseline justify-between gap-4 py-3"><dt>{claim}</dt><dd className="shrink-0 font-semibold">{status}</dd></div>
            ))}
          </dl>
        </Card>
        <p className="text-xs leading-relaxed text-[var(--zk-text-soft)]">Local-first does not mean Zik stores no data. Operational services may still hold public keys, status and revocation data, issuer metadata, fraud signals and audit events. The future Vault needs a separate security and data architecture decision before implementation. Planned prices cannot be charged here, and Zik ID is not currently accepted as physical identification.</p>
      </div>
    </CustomerShell>
  );
}
