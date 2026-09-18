import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink, Card } from "@/components/customer/ui";

export const metadata = {
  title: "Affiliate onboarding · Zik Pass",
  description: "Explore bringing Zik Pass age verification to your website."
};

export default function AffiliatesPage() {
  return (
    <CustomerShell active="about" title="Affiliates" back={{ href: "/about", label: "About" }}>
      <div className="space-y-5 pb-6 pt-5">
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-1" : undefined}>For affiliate sites</p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-2" : undefined}>Bring Zik Pass<br />to your website.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-3" : undefined}>Give customers a way to confirm they’re over 18 using their existing pass, without sharing their identity documents with your site.</p>
        </section>
        <Card as="section" className="p-5">
          <h2 className="text-xl font-bold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-4" : undefined}>What onboarding involves</h2>
          <ol className="mt-4 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-[var(--zk-text-soft)]">
            <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-5" : undefined}><strong className="text-[var(--zk-text)]">Tell us about your site.</strong> Prepare your website URL, organisation name and the customer journey where an age check is needed.</li>
            <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-6" : undefined}><strong className="text-[var(--zk-text)]">Plan the integration.</strong> Review the approval screen, return to your site and the verification result your backend receives.</li>
            <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-7" : undefined}><strong className="text-[var(--zk-text)]">Test the complete journey.</strong> Walk through successful checks, cancellations, expired passes and retries before discussing launch.</li>
          </ol>
        </Card>
        <section className="rounded-none bg-ink p-5 text-[var(--zk-text-on-ink)]">
          <h2 className="text-xl font-bold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-8" : undefined}>See the customer experience</h2>
          <p className="mb-5 mt-3 text-sm leading-relaxed" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-9" : undefined}>Our affiliate demo shows how a site requests an age check and how the customer approves it with Zik Pass.</p>
          <ButtonLink href="/affiliate-demo" variant="secondary">Try the affiliate demo</ButtonLink>
        </section>
        <Card as="section" className="p-5">
          <h2 className="text-lg font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-10" : undefined}>Arrange a walkthrough</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-11" : undefined}>Contact the person who shared this demo with you to discuss your site and arrange onboarding. Self-service registration and booking are not connected in this prototype.</p>
        </Card>
      </div>
    </CustomerShell>
  );
}
