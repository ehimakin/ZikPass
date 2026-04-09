import { AppShell } from "@/components/app-shell";
import { WalletSurface } from "@/components/wallet-surface";

export default function WalletPage() {
  return (
    <AppShell currentPath="/wallet">
      <main className="grid gap-6">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Get your Zik Pass</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
            Complete a first-time check, confirm a refundable bank verification, and receive a
            private Over-18 pass stored on this device.
          </p>
        </div>
        <WalletSurface />
      </main>
    </AppShell>
  );
}
