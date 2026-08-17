import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PwaInstallButton } from "@/components/pwa-install-button";

export default function NativeHandoffFallbackPage() {
  return (
    <AppShell currentPath="/">
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="w-full max-w-xl rounded-[34px] border border-white/80 bg-white/72 p-8 text-center shadow-panel backdrop-blur-sm sm:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/45">Native wallet</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-ink">
            Open ZikPass on this device
          </h1>
          <p className="mt-4 text-sm leading-7 text-ink/68">
            The native development build is not installed yet. You can install the web wallet for now,
            or return to the browser wallet.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <PwaInstallButton
              className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist"
              label="Install web wallet"
            />
            <Link
              className="rounded-full border border-ink/12 bg-[#f7faee] px-5 py-3 text-sm font-semibold text-ink"
              href="/wallet"
            >
              Open browser wallet
            </Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
