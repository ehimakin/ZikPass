import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { WalletSurface } from "@/components/wallet-surface";

export default function WalletPage() {
  return (
    <AppShell currentPath="/wallet">
      <main>
        <Suspense fallback={null}>
          <WalletSurface />
        </Suspense>
      </main>
    </AppShell>
  );
}
