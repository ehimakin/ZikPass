import { AppShell } from "@/components/app-shell";
import { WalletSurface } from "@/components/wallet-surface";

export default function WalletPage() {
  return (
    <AppShell currentPath="/wallet">
      <main>
        <WalletSurface />
      </main>
    </AppShell>
  );
}
