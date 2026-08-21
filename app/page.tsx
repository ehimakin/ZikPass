import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { HomepageSplash } from "@/components/homepage-splash";
import { WalletSurface } from "@/components/wallet-surface";
import { runtimeConfig } from "@/lib/shared/config";

export default async function HomePage() {
  const cookieStore = await cookies();
  const lastSeenAt = Number(cookieStore.get("zikpass-home-splash-seen")?.value);
  const suppressWindowMs = runtimeConfig.homepageSplashSuppressSeconds * 1000;
  const seenRecently = Number.isFinite(lastSeenAt) && Date.now() - lastSeenAt < suppressWindowMs;

  return (
    <AppShell currentPath="/">
      <main>
        <Suspense fallback={null}>
          <WalletSurface homepageMode />
        </Suspense>
      </main>
      <HomepageSplash enabled={!seenRecently} />
    </AppShell>
  );
}
