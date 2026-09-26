import { CustomerShell } from "@/components/customer/customer-shell";
import { FinanceCheckPreview } from "@/components/customer/finance-check-preview";
import { ButtonLink, Card, StatusBadge } from "@/components/customer/ui";

export const metadata = {
  title: "Prove with a finance check · Zik Pass",
  description: "Product 7: a proposed fully remote route to an 18+ Zik Pass using a soft credit-history check. £3.99 one-off includes ZikVault and passport verification. Explore the prototype."
};

export default function FinanceCheckPage() {
  return (
    <CustomerShell active="about" title="Prove with a finance check">
      <div className="space-y-6 pb-8">
        <section className="pt-5">
          <StatusBadge>Product 7 · Remote route · Prototype</StatusBadge>
          <h1 className="mt-4 text-[36px] font-extrabold leading-tight tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-1" : undefined}>Your age. Checked from home.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-2" : undefined}>A proposed fully remote way to get your 18+ Zik Pass, using an identity and age match against credit-reference records. No shop visit. No credit application.</p>
          <div className="mt-5 rounded-2xl bg-[var(--zk-sunken)] p-5">
            <p className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-3" : undefined}>£3.99 <span className="text-sm font-semibold">proposed one-off price</span></p>
            <p className="mt-2 text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-4" : undefined}>Includes the finance check, ZikVault and passport verification. No separate passport-check fee or Vault subscription for this bundle. This walkthrough is free; no payment or real check takes place.</p>
          </div>
          <ButtonLink href="#preview" className="mt-5">Try the sample journey</ButtonLink>
        </section>
        <Card as="section" className="!rounded-2xl p-5">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-5" : undefined}>How the remote route would work</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-6" : undefined}>Review the named provider’s privacy notice and authorise an identity and age check using your name, date of birth and address history.</li>
            <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-7" : undefined}>The provider matches age evidence and checks that the records belong to you. A good credit score would not be required.</li>
            <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-8" : undefined}>Add a passport scan to your included ZikVault to start the planned passport-verification layer. Review who will receive the scan before authorising remote checking; the check is included in £3.99.</li>
            <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-9" : undefined}>If the age evidence and identity safeguards meet the required standard, continue to the proposed £3.99 payment and bind the pass to your device.</li>
            <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-10" : undefined}>Use your Zik Pass at participating sites that accept this verification method. The intended disclosure is an 18+ result and verification metadata, not your credit history.</li>
          </ol>
        </Card>
        <Card as="section" className="!rounded-2xl p-5 space-y-3">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-11" : undefined}>Your Vault. Passport verification included.</h2>
          <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-12" : undefined}>The £3.99 bundle includes a place to keep your documents and a planned remote verification step whenever you add a passport scan. You would see the provider, the information being shared and how it will be used before the scan leaves your device.</p>
          <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-13" : undefined}>A document check and a check that you are its holder are separate results. A stored or readable scan would not automatically become a verified identity or an 18+ pass. Additional holder checks may be needed.</p>
          <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-14" : undefined}>Today, Vault storage and reading happen on this device; remote passport verification is not connected yet. Optional cloud backup is separate from this bundle.</p>
          <ButtonLink href="/vault" variant="secondary">Explore ZikVault</ButtonLink>
        </Card>
        <FinanceCheckPreview />
        <Card as="section" className="!rounded-2xl p-5 space-y-3">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-15" : undefined}>An age check, not a credit score test</h2>
          <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-16" : undefined}>The planned soft search would check identity and age, not whether you qualify for borrowing. Soft searches generally do not affect your credit score; the selected provider’s notice must explain the exact search footprint before launch.</p>
          <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-17" : undefined}>Little or no credit history, a recent move or a mismatch may mean this route cannot confirm your age. That does not mean you are under 18. You would be offered another route and a way to challenge an incorrect result.</p>
          <ButtonLink href="/find" variant="secondary">Explore the in-person route</ButtonLink>
        </Card>
        <Card as="section" className="!rounded-2xl p-5 space-y-3">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-18" : undefined}>Where could this pass be used?</h2>
          <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-19" : undefined}>This route is being assessed for online 18+ use. A credit-file match alone provides less assurance that the applicant is the adult in the records. Launch depends on provider checks, testing and legal review; this prototype is not an approved age certificate.</p>
          <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-20" : undefined}>Acceptance would depend on each site’s requirements. It would not be a physical photo ID or a guarantee of access to every age-restricted service.</p>
        </Card>
        <ButtonLink href="/ecosystem" variant="secondary">Explore the Zik ecosystem</ButtonLink>
      </div>
    </CustomerShell>
  );
}
