import { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { WalletSurface } from "@/components/wallet-surface";

const affiliateMarks = ["PHub", "XVideos", "Redtube"];

export default async function WalletPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const physicalEntry =
    getParam(params.flow) === "physical" ||
    Boolean(getParam(params.session_id)) ||
    Boolean(getParam(params.store_id));

  if (physicalEntry) {
    return (
      <main>
        <Suspense fallback={null}>
          <WalletSurface />
        </Suspense>
      </main>
    );
  }

  return (
    <AppShell currentPath="/wallet">
      <WalletEmptyState />
    </AppShell>
  );
}

function WalletEmptyState() {
  return (
    <main className="flex min-h-[calc(100vh-168px)] flex-1 flex-col overflow-hidden px-4 py-8 text-ink sm:px-6 lg:px-8">
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[40px] border border-white/80 bg-white/72 px-6 py-20 text-center shadow-panel backdrop-blur-sm sm:px-10">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,_rgba(215,241,113,0.34),_transparent_48%)]" />
        <div className="relative max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/45">Wallet status</p>
          <h1 className="mt-4 font-heading text-5xl font-semibold leading-[0.95] sm:text-7xl">
            No passes presently in wallet
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-ink/68">
            Start a physical ID check to create an anonymous digital ID for this device.
          </p>
        </div>
        <Link
          className="relative mt-8 rounded-full bg-ink px-8 py-4 text-base font-semibold text-mist transition hover:bg-ink/85"
          href="/onboarding"
        >
          Get ZikPass
        </Link>
      </section>

      <footer className="px-5 py-5">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
          {affiliateMarks.map((mark) => (
            <span
              key={mark}
              className="inline-flex h-11 min-w-28 items-center justify-center rounded-[8px] border border-ink/10 bg-white/78 px-4 text-sm font-semibold text-ink shadow-[0_10px_24px_rgba(14,23,38,0.05)]"
            >
              {mark}
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
