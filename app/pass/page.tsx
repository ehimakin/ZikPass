import { appleWalletDemoConfigured } from "@/lib/server/apple-wallet";
import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { PhoneHero } from "@/components/customer/home-screen";
import { PassScreen } from "@/components/customer/pass-screen";

export const dynamic = "force-dynamic";

export default function MyPassPage() {
  return (
    <CustomerShell active="wallet" back={{ href: "/wallet", label: "Wallet" }} hero={<PhoneHero />}>
      <div className="pt-4">
        <Suspense fallback={null}>
          <PassScreen appleWalletAvailable={appleWalletDemoConfigured()} />
        </Suspense>
      </div>
    </CustomerShell>
  );
}
