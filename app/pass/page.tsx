import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { PhoneHero } from "@/components/customer/home-screen";
import { PassScreen } from "@/components/customer/pass-screen";

export default function MyPassPage() {
  return (
    <CustomerShell active="pass" hero={<PhoneHero />}>
      <div className="pt-4">
        <Suspense fallback={null}>
          <PassScreen />
        </Suspense>
      </div>
    </CustomerShell>
  );
}
