import { AppShell } from "@/components/app-shell";
import { WalletSurface } from "@/components/wallet-surface";

export default function WalletPage() {
  return (
    <AppShell currentPath="/wallet">
      <main className="grid gap-6">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Wallet enrollment</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
            This sprint-two flow is designed for ease of use: one question per screen, automatic
            wallet binding, immediate pass delivery after confirmation, and a visible cooling-off
            period before the credential becomes usable at a vendor.
          </p>
        </div>
        <WalletSurface />
      </main>
    </AppShell>
  );
}
