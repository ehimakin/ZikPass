import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PwaInstallButton } from "@/components/pwa-install-button";

export default function NativeHandoffFallbackPage() {
  return (
    <AppShell currentPath="/">
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="w-full max-w-xl rounded-[34px] border border-white/10 bg-white/[0.03] p-8 text-center sm:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime/70">Native wallet</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-mist">
            Open ZikPass on this device
          </h1>
          <p className="mt-4 text-sm leading-7 text-mist/55">
            The native app isn&rsquo;t installed yet. Install the web wallet, or continue in the browser.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <PwaInstallButton
              className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink"
              label="Install web wallet"
            />
            <Link
              className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-mist/80"
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
