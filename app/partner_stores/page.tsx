import { StoreAccessSetup } from "@/components/customer/partners/store-access-setup";
import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink, Card, StatusBadge } from "@/components/customer/ui";
import { PartnerOnboarding } from "@/components/customer/partners/partner-onboarding";
import { partnerPrototypeEnabled } from "@/lib/server/partner-applications";

export const metadata = {
  title: "Become a Zik partner store",
  description: "Offer in-person Zik Pass checks and physical Zik Cards. Apply to join the Zik store network."
};

export default function PartnerStoresPage() {
  return <CustomerShell active="about" title="Partner stores">
    <div className="space-y-7 py-6">
      <header className="space-y-4">
        <StatusBadge>Partner Stores</StatusBadge>
        <h1 className="text-4xl font-extrabold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-1" : undefined}>Bring Zik to your store.</h1>
        <p className="text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-2" : undefined}>{"."}</p>
        <div className="grid grid-cols-2 gap-3"><ButtonLink href="#enquire" size="lg" className="min-w-0 !px-2 !text-sm text-center sm:!px-6 sm:!text-base">Become a partner</ButtonLink><ButtonLink href="/dashboard/store" variant="secondary" size="lg" className="min-w-0 !px-2 !text-sm text-center sm:!px-6 sm:!text-base">Store dashboard</ButtonLink></div>
      </header>
      <section className="grid gap-3" aria-label="What your store can offer">
        <Card className="!rounded-2xl p-5"><h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-3" : undefined}>Digital Zik Pass</h2><p className="mt-2 text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-4" : undefined}>Check photo ID in person. Help customers add their pass to their phone.</p><p className="mt-3 text-sm font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-5" : undefined}>99p one-off · Free during Early Access</p></Card>
        <Card className="!rounded-2xl p-5"><h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-6" : undefined}>Physical Zik Card</h2><p className="mt-2 text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-7" : undefined}>Sell a card at the counter and help link it to the customer’s phone.</p><p className="mt-3 text-sm font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-8" : undefined}>£2.99 · Customers keep their card for life</p></Card>
      </section>
      <section aria-labelledby="partner-steps"><h2 id="partner-steps" className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-9" : undefined}>From application to your first customer</h2><ol className="mt-4 space-y-4 text-sm">{["Tell us about your store", "Agree setup, staff guidance and commercial terms", "Activate your location and start serving customers"].map((step, index) => <li key={step} className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--zk-sunken)] font-bold">{index + 1}</span>{step}</li>)}</ol></section>
      <details className="rounded-2xl border border-[var(--zk-line)] p-5"><summary className="cursor-pointer font-semibold">What to know before joining</summary><div className="mt-4 space-y-3 text-sm text-[var(--zk-text-soft)]"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-10" : undefined}>Setup covers staff access, accepted-ID guidance, card supply, activation and support. A device with internet access is needed for staff verification.</p><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-11" : undefined}>Customer prices above are not a promise of store commission. Fees, any revenue share, stock arrangements and launch timing are agreed before activation.</p><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-12" : undefined}>Applying does not approve your store or add it to the public directory. Only confirmed participating locations will be listed.</p><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-04a193d3718d-13" : undefined}>Staff check physical ID; this flow does not ask them to upload an ID image. The future finance-check route is separate from in-store verification.</p></div></details>
      <section id="enquire" className="scroll-mt-20" aria-label="Store partnership application"><PartnerOnboarding enabled={partnerPrototypeEnabled()} /></section>
      <div id="store-setup" className="scroll-mt-20"><StoreAccessSetup /></div>
      <div className="flex flex-wrap gap-3"><ButtonLink href="/dashboard/store" variant="secondary">Store dashboard</ButtonLink><ButtonLink href="/affiliates" variant="ghost">Run a website instead?</ButtonLink></div>
    </div>
  </CustomerShell>;
}
