import { Suspense } from "react";
import type { Route } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";
import { OnboardingFlow } from "@/components/customer/onboarding/onboarding-flow";
import { getPassPrice } from "@/lib/shared/payment-config";

export default async function GetPassPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const backHref = raw === "retail_card" ? "/find?entry=retail_card" : "/find";

  return (
    <CustomerShell active="find" back={{ href: backHref as Route, label: "Stores" }}>
      <Suspense fallback={null}>
        <OnboardingFlow price={getPassPrice()} />
      </Suspense>
    </CustomerShell>
  );
}
