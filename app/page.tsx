import { Suspense } from "react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { HomepageSplash } from "@/components/homepage-splash";
import { WalletSurface } from "@/components/wallet-surface";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSeenSplash = cookieStore.get("zikpass-home-splash-seen")?.value === "1";

  return (
    <AppShell currentPath="/">
      <main>
        <Suspense fallback={null}>
          <WalletSurface homepageMode />
        </Suspense>
      </main>
      <HomepageSplash enabled={!hasSeenSplash} />
    </AppShell>
  );
}
