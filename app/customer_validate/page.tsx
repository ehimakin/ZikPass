import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink, Card, StatusBadge } from "@/components/customer/ui";

export const metadata = {
  title: "Zik Validate · Professional validation",
  description: "A planned premium service for passport photo countersigning and ID application validation by eligible professionals. Proposed £9.99 one-time fee."
};

const steps = [
  ["Tell us what needs validating", "The planned service will start with your application type and the receiving organisation’s requirements for photo countersigning or identity confirmation."],
  ["Choose an eligible professional", "Start with a participating dentist or other reputable professional who knows you and meets the application’s requirements. A future network could also include doctors and other eligible professionals."],
  ["Get your application reviewed", "Your professional would review the request and confirm only what they can personally vouch for. Some requests may need an in-person appointment; this option is being explored."],
  ["Complete the required confirmation", "Where eligible, the professional would complete the confirmation in the format the receiving organisation requires. The proposed price is £9.99 per validation, with no subscription."]
];

export default function CustomerValidatePage() {
  return (
    <CustomerShell active="about" title="Zik Validate">
      <div className="space-y-6 pb-8">
        <Card className="!rounded-2xl p-5"><p className="mb-3 text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-12" : undefined}>The document validation workflow is now available as a local prototype. The original service concept is retained below.</p><ButtonLink href="/validate">Explore Zik Validate →</ButtonLink></Card>
        <section className="pt-5">
          <StatusBadge>Product 6 · Planned premium service</StatusBadge>
          <h1 className="mt-4 text-[36px] font-extrabold leading-tight tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-1" : undefined}>A trusted professional. A personal confirmation.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-2" : undefined}>Zik Validate brings the familiar request — “Can you sign my passport photo or vouch for my ID application?” — into a digital service. It starts with people who already turn to their dentist or another reputable professional for help.</p>
          <div className="mt-5 rounded-2xl bg-[var(--zk-sunken)] p-5">
            <p className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-3" : undefined}>£9.99 <span className="text-sm font-semibold">proposed one-time fee</span></p>
            <p className="mt-2 text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-4" : undefined}>Per validation · No subscription. Final pricing and service availability will be confirmed before launch.</p>
          </div>
          <ButtonLink href="#how-it-works" variant="secondary" className="mt-5">How Zik Validate would work</ButtonLink>
        </section>
        <section id="how-it-works" className="scroll-mt-24" aria-labelledby="validate-steps-title">
          <h2 id="validate-steps-title" className="text-2xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-5" : undefined}>From request to confirmation</h2>
          <ol className="mt-4 space-y-3">
            {steps.map(([title, detail], index) => (
              <li key={title}>
                <Card className="!rounded-2xl p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--zk-text-soft)]">Step {index + 1}</p>
                  <h3 className="mt-2 text-lg font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]">{detail}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>
        <Card as="section" className="!rounded-2xl p-5">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-6" : undefined}>For dentists, doctors and other professionals</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-7" : undefined}>We’re exploring a peer-to-peer platform where eligible professionals can sign up, have their professional credentials checked and offer paid validations. Digital requests would come first, with in-person validation appointments a possible extension.</p>
          <p className="mt-3 text-sm font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-8" : undefined}>Professional registration is not open yet.</p>
        </Card>
        <Card as="section" className="!rounded-2xl p-5">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-9" : undefined}>The right person for the application</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-10" : undefined}>Each receiving organisation sets its own rules, including eligible professions, how well the professional must know you and how confirmation must be submitted. A platform match alone does not establish eligibility, and paying for a review does not guarantee an endorsement or acceptance of your application.</p>
        </Card>
        <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-1a31761225ef-11" : undefined}>Zik Validate is in development. Real applications, bookings and payments are not available. Dummy document uploads are available in the local workflow prototype.</p>
        <ButtonLink href="/ecosystem" variant="secondary">Explore the Zik ecosystem</ButtonLink>
      </div>
    </CustomerShell>
  );
}
