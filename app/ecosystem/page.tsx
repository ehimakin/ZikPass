import { HomeHero } from "@/components/customer/home-screen";
import { CustomerShell } from "@/components/customer/customer-shell";
import { ProductFamily } from "@/components/customer/product-family";
import { ValidationWorkflow } from "@/components/validate/workflow";
import { Card, StatusBadge, ButtonLink } from "@/components/customer/ui";
import { getPassPrice } from "@/lib/shared/payment-config";

export const metadata = {
  title: "The Zik ecosystem",
  description: "Explore Zik Pass, ZikVault, Zik ID and Zik Validate, our document attestation prototype, plus Product 7: a £3.99 remote finance-check route to Zik Pass."
};

export default function EcosystemPage() {
  return (
    <div className="zk-ecosystem-page"><CustomerShell active="about" hero={<HomeHero />} immersive>
      <div>
        <section className="zk-ecosystem-hero">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-1" : undefined}>One principle. A growing ecosystem.</p>
          <h1 className="mt-4 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-7xl lg:text-8xl" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-2" : undefined}>The Zik ecosystem</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90 sm:text-xl" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-3" : undefined}>Your age, documents and identity. Always on your terms.</p>
          <a href="#ecosystem-products" className="mt-8 inline-flex w-fit rounded-lg border border-white/50 bg-black/20 px-5 py-3 font-semibold text-white hover:bg-black/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-18" : undefined}>Explore the Zik suite ↓</a>
        </section>
        <div className="zk-ecosystem-content relative px-4 py-10"><div id="ecosystem-products" className="mx-auto max-w-[760px] scroll-mt-20 space-y-6">
        <p className="rounded-xl border border-white/40 bg-white/80 p-4 text-sm font-semibold backdrop-blur-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-4" : undefined}>{"ZikVault works on this device: you can store documents securely within it and have them read here, locally. Zik ID is not available"}</p>
        <section aria-labelledby="products-title">
          <h2 id="products-title" className="mb-4 text-xl font-bold text-white" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-5" : undefined}>Zik starts with Zik Pass.</h2>
          <ProductFamily price={getPassPrice().display} vaultLinkLabel="Get Zik Vault" />
        </section>
        <details className="rounded-2xl border border-white/40 bg-white/85 p-5 backdrop-blur-sm"><summary className="cursor-pointer font-semibold">Privacy, verification & future products</summary><div className="mt-4 space-y-4">
        <Card as="section" className="!rounded-2xl p-5">
          <StatusBadge>Trusted attestation · Prototype</StatusBadge>
          <h2 className="mt-3 text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-14" : undefined}>Zik Validate</h2>
          <p className="mt-2 font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-15" : undefined}>Get a document independently verified.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-16" : undefined}>ZikPass proves an attribute. Zik Vault holds documents and, in future, verified credentials. Zik ID would selectively present identity. Zik Validate adds a workflow for obtaining a trusted attestation: what needs to be established, who is qualified, and exactly what they confirmed.</p>
          <ValidationWorkflow />
          <p className="mb-4 text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-17" : undefined}>Requirements vary by document, receiving organisation and jurisdiction. Zik provides evidence of the attestation, not a guarantee of its underlying truth.</p>
          <ButtonLink href="/validate" variant="secondary">Explore Zik Validate →</ButtonLink>
        </Card>
        <Card as="section" className="p-5">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-6" : undefined}>{"Verify once. Choose what to disclose."}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-7" : undefined}>Verifying identity and disclosing identity are separate actions. Today, Zik Pass proves one attribute: you’re 18+. A participating site receives the minimum age assertion and verification metadata, without your name, exact date of birth, photograph, address or identity document.</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2b27d2feb142-8" : undefined}>ZikVault now does part of this. Documents you choose are stored encrypted on this device, and Zik can read them here — on your device, never on a server — to suggest details you then review. Documents are not sent to an AI provider. If you explicitly enable account recovery, an encrypted snapshot is stored by Zik; only your recovery phrase can unlock that backup.</p>
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
        </div></details>
        </div></div>
      </div>
    </CustomerShell></div>
  );
}
