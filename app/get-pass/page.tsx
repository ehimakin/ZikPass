import { Suspense } from "react";
import type { Route } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";
import { OnboardingFlow } from "@/components/customer/onboarding/onboarding-flow";
import { getPassPrice } from "@/lib/shared/payment-config";

export default function GetPassPage() {
  return (
    <CustomerShell active="find" back={{ href: "/find" as Route, label: "Stores" }}>
      <Suspense fallback={null}>
        <OnboardingFlow price={getPassPrice()} />
      </Suspense>
    </CustomerShell>
  );
}
