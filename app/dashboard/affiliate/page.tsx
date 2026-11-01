import { AffiliateOnboarding } from "@/components/affiliate-onboarding";
import { developmentOnboardingEnabled } from "@/lib/server/affiliate-onboarding";
import { ButtonLink } from "@/components/customer/ui";
export default function Page() {
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-12"><h1 className="text-4xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e228b5f5743a-1" : undefined}>Affiliate site workspace</h1><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-e228b5f5743a-2" : undefined}>Use your setup invitation to access your website’s integration and credentials.</p>
    {developmentOnboardingEnabled() ? <AffiliateOnboarding /> : <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-e228b5f5743a-3" : undefined}>Affiliate setup is by arrangement during Early Access. Contact the partner team for access.</p>}<ButtonLink href="/help#contact-support">Contact the partner team</ButtonLink></main>;
}
