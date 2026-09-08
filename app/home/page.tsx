import { CustomerShell } from "@/components/customer/customer-shell";
import { HomeScreen, HomeHero } from "@/components/customer/home-screen";
import { getPassPrice } from "@/lib/shared/payment-config";

export default function CustomerHomePage() {
  return (
    <CustomerShell active="home" hero={<HomeHero />}>
      <HomeScreen price={getPassPrice().display} />
    </CustomerShell>
  );
}
