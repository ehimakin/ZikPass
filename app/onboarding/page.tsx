import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { WalletSurface } from "@/components/wallet-surface";

export default function OnboardingPage() {
  return (
    <AppShell currentPath="/onboarding">
      <main>
        <Suspense fallback={null}>
          <WalletSurface onboardingMode />
        </Suspense>
      </main>
    </AppShell>
  );
}
