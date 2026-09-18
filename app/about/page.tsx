import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink, Card } from "@/components/customer/ui";
import { ZikLogoMark } from "@/components/zik-logo";

export const metadata = {
  title: "About Zik",
  description: "How Zik Pass works for customers, stores and participating websites."
};

export default function AboutPage() {

  return (
    <CustomerShell active="about" title="About">
      <div className="space-y-5 pb-6">
        <section className="pb-3 pt-5">
          <ZikLogoMark className="zk-logo-float mb-5 h-12 w-12" />
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-1" : undefined}>About Zik</p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-2" : undefined}>Check once.<br />Share less.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-3" : undefined}>
            Zik connects an in-person age check with a reusable digital pass.
            Customers prove they’re over 18 on participating sites without sending those sites their identity documents.
          </p>
        </section>

        <Card as="section" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-4" : undefined}>For customers</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-5" : undefined}>Your age check, on your device.</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-6" : undefined}>Visit a store, show your photo ID and save your pass. When a participating site asks, choose whether to confirm you’re over 18.</p>
          <details className="mt-4">
            <summary className="w-fit cursor-pointer rounded-full border border-[var(--zk-line-strong)] px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zk-focus)]">Learn more<span className="sr-only" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-7" : undefined}> for customers</span></summary>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--zk-text-soft)]">
              <ol className="list-decimal space-y-2 pl-5"><li data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-8" : undefined}>Choose a store and bring photo ID for the in-person check.</li><li data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-9" : undefined}>Show your customer code to staff, complete the device check and pay if required.</li><li data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-10" : undefined}>Open My pass to use your pass on participating sites.</li></ol>
              <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-11" : undefined}>The site receives an age-threshold result and verification metadata—not your name, date of birth or a copy of your ID.</p>
              <ButtonLink href="/find">Find a store</ButtonLink>
            </div>
          </details>
        </Card>

        <Card as="section" className="p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-12" : undefined}>For stores</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-13" : undefined}>A familiar check. A reusable result.</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-14" : undefined}>Staff check the customer’s physical ID and confirm the result through the store’s verification screen.</p>
          <details className="mt-4">
            <summary className="w-fit cursor-pointer rounded-full border border-[var(--zk-line-strong)] px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zk-focus)]">Learn more<span className="sr-only" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-15" : undefined}> for stores</span></summary>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--zk-text-soft)]">
              <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-16" : undefined}>Look up the customer code, confirm you’re serving the correct store session, and record the in-person check. For payment at the till, confirm payment before the pass is issued.</p>
              <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-17" : undefined}>The prototype records an age-check result; it does not ask staff to upload an ID image. Store onboarding would establish staff access, accepted-ID guidance and payment arrangements.</p>
              <ButtonLink href="/verify">Explore the staff demo</ButtonLink>
            </div>
          </details>
        </Card>

        <section className="rounded-none bg-ink p-5 text-[var(--zk-text-on-ink)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--zk-accent)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-18" : undefined}>For affiliate sites</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-19" : undefined}>Let customers bring their age check.</h2>
          <p className="mt-3 text-sm leading-relaxed" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-20" : undefined}>Add Zik Pass to your website so customers can approve an age check using their existing pass.</p>
          <p className="mt-3 text-sm leading-relaxed" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-21" : undefined}>Onboarding covers your website’s verification flow, approved return URLs, backend integration and testing before launch.</p>
          <div className="mt-5 flex flex-col gap-3">
            <ButtonLink href="/affiliates" variant="secondary">Arrange affiliate onboarding</ButtonLink>
            <ButtonLink href="/affiliate-demo" variant="secondary">Try the affiliate demo</ButtonLink>
          </div>
        </section>
        <Card as="section" className="p-5">
          <h2 className="text-xl font-bold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-22" : undefined}>Zik Pass is just the start.</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-23" : undefined}>Zik separates verifying information from disclosing it. Zik Pass is the first product: prove you’re 18+ without giving participating sites your identity. ZikVault and Zik ID extend that principle to broader identity use.</p>
          <p className="mt-3 text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-24" : undefined}>ZikVault and Zik ID are planned products and are not available in this prototype.</p>
          <ButtonLink href="/ecosystem" variant="secondary" className="mt-4">The Zik ecosystem</ButtonLink>
        </Card>
        <p className="px-1 text-xs leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-06f49e315854-25" : undefined}>You’re exploring a prototype. Store locations and payments in this demo are simulated; live partner onboarding requires separate setup.</p>
      </div>
    </CustomerShell>
  );
}
