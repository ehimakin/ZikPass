import { DashboardAffiliateInvite } from "@/components/dashboard-affiliate-invite";
import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink } from "@/components/customer/ui";


export const dynamic = "force-dynamic";
export const metadata = { title: "Affiliate onboarding · Zik Pass", description: "Connect your website to Zik Pass age verification." };
export default function AffiliatesPage() {
  return <CustomerShell active="about" title="Affiliates" back={{ href: "/about", label: "About" }}>
    <DashboardAffiliateInvite /><div className="space-y-5 pb-6 pt-5"><section><p className="text-xs font-semibold uppercase tracking-widest text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-1" : undefined}>For affiliate sites</p><h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-2" : undefined}>Bring Zik Pass<br />to your website.</h1><p className="mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-3297fff285d2-3" : undefined}>One setup link. Your developer or a walkthrough with us. Confirm customers are over 18 without receiving their identity documents.</p></section>
    <ButtonLink href="/dashboard/affiliate">Open affiliate workspace</ButtonLink><div className="flex flex-wrap gap-3"><ButtonLink href="/partner_stores" variant="secondary">Have a physical store?</ButtonLink><ButtonLink href="/help#contact-support" variant="secondary" className="ml-auto">Contact the partner team</ButtonLink></div></div>
  </CustomerShell>;
}
