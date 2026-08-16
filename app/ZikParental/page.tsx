import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function ZikParentalPage() {
  return (
    <AppShell currentPath="/ZikParental">
      <main className="flex flex-1 items-center px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-4xl rounded-[40px] border border-white/80 bg-white/72 p-8 shadow-panel backdrop-blur-sm sm:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/45">Zik Parental Controls</p>
          <h1 className="mt-4 max-w-3xl font-heading text-5xl font-semibold leading-[0.94] tracking-tight text-ink sm:text-7xl">
            More control around trusted devices and pass use.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-ink/68">
            This placeholder will become the home for pass transfer reviews, trusted-device settings,
            and additional safeguards for families.
          </p>
          <Link
            className="mt-8 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist transition hover:bg-[#24364d]"
            href="/"
          >
            Back to ZikPass
          </Link>
        </section>
      </main>
    </AppShell>
  );
}
