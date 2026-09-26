import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink, Card, StatusBadge } from "@/components/customer/ui";
import { TicketCreate } from "@/components/customer/support/ticket-create";

export const metadata = {
  title: "Become a Zik partner store",
  description: "Offer in-person Zik Pass checks and physical Zik Cards. Enquire about joining the Zik store network."
};

export default function PartnerStoresPage() {
  return <CustomerShell active="about" title="Partner stores">
    <div className="space-y-7 py-6">
      <header className="space-y-4">
        <StatusBadge>Partner enquiries open</StatusBadge>
        <h1 className="text-4xl font-extrabold tracking-tight">Bring Zik to your store.</h1>
        <p className="text-[var(--zk-text-soft)]">A familiar ID check. A pass customers can keep.</p>
        <ButtonLink href="#enquire" size="lg">Become a partner</ButtonLink>
      </header>
      <section className="grid gap-3" aria-label="What your store can offer">
        <Card className="!rounded-2xl p-5"><h2 className="text-xl font-bold">Digital Zik Pass</h2><p className="mt-2 text-sm">Check photo ID in person. Help customers add their pass to their phone.</p><p className="mt-3 text-sm font-semibold">99p one-off · Free during Early Access</p></Card>
        <Card className="!rounded-2xl p-5"><h2 className="text-xl font-bold">Physical Zik Card</h2><p className="mt-2 text-sm">Sell a card at the counter and help link it to the customer’s phone.</p><p className="mt-3 text-sm font-semibold">£2.99 · Customers keep their card for life</p></Card>
      </section>
      <section aria-labelledby="partner-steps"><h2 id="partner-steps" className="text-xl font-bold">From enquiry to your first customer</h2><ol className="mt-4 space-y-4 text-sm">{["Tell us about your store", "Agree setup, staff guidance and commercial terms", "Activate your location and start serving customers"].map((step, index) => <li key={step} className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--zk-sunken)] font-bold">{index + 1}</span>{step}</li>)}</ol></section>
      <details className="rounded-2xl border border-[var(--zk-line)] p-5"><summary className="cursor-pointer font-semibold">What to know before joining</summary><div className="mt-4 space-y-3 text-sm text-[var(--zk-text-soft)]"><p>Setup covers staff access, accepted-ID guidance, card supply, activation and support. A device with internet access is needed for staff verification.</p><p>Customer prices above are not a promise of store commission. Fees, any revenue share, stock arrangements and launch timing are agreed before activation.</p><p>Enquiring does not approve your store or add it to the public directory. Only confirmed participating locations will be listed.</p><p>Staff check physical ID; this flow does not ask them to upload an ID image. The future finance-check route is separate from in-store verification.</p></div></details>
      <section id="enquire" className="scroll-mt-20" aria-label="Store partnership enquiry"><TicketCreate partnerStore /></section>
      <div className="flex flex-wrap gap-3"><ButtonLink href="/store" variant="secondary">Already a partner? Staff sign-in</ButtonLink><ButtonLink href="/affiliates" variant="ghost">Run a website instead?</ButtonLink></div>
    </div>
  </CustomerShell>;
}
