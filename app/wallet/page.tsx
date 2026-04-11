import { AppShell } from "@/components/app-shell";
import { WalletSurface } from "@/components/wallet-surface";

export default function WalletPage() {
  return (
    <AppShell currentPath="/wallet">
      <main className="grid gap-6">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/48">
            Sprint 4 wallet redesign
          </p>
          <p className="mt-2 text-sm leading-6 text-ink/66">
            The new-user journey below has been redesigned to feel closer to a premium consumer
            onboarding flow while keeping the same underlying Sprint 3 logic.
          </p>
        </div>
        <WalletSurface />
      </main>
    </AppShell>
  );
}
