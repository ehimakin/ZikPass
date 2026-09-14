import { CustomerShell } from "@/components/customer/customer-shell";
import { HomeScreen, HomeHero } from "@/components/customer/home-screen";
import { getPassPrice } from "@/lib/shared/payment-config";
import { HomepageSplash } from "@/components/homepage-splash";
import { runtimeConfig } from "@/lib/shared/config";

export default function CustomerHomePage() {
  return (
    <CustomerShell active="home" hero={<HomeHero />} immersive>
      <HomepageSplash suppressSeconds={runtimeConfig.homepageSplashSuppressSeconds} />
      <HomeScreen price={getPassPrice().display} />
    </CustomerShell>
  );
}
