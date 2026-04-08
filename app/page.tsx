import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";

const steps = [
  "The user launches Get Zik Pass and answers one plain-language question at a time.",
  "A refund-reference possession check completes the enrollment and triggers credential delivery.",
  "The credential lands in the wallet immediately, but remains inactive through cooling-off.",
  "A betting-style vendor requests a single Zik Pass verification at the point of entry.",
  "The vendor validates issuer trust, holder possession, activation, expiry, and the claim locally."
];

export default function HomePage() {
  return (
    <AppShell currentPath="/">
      <HeroSlideshow />

      <main id="learn-more" className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <SurfaceCard
          title="Sprint-two journey"
          subtitle="A guided consumer flow from new user to credential receipt, cooling-off, and vendor-side access."
          className="overflow-hidden"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <StatusPill tone="good">Core principle</StatusPill>
              <h2 className="font-heading text-4xl font-semibold tracking-tight">
                Get a reusable Over-18 pass without handing over identity.
              </h2>
              <p className="max-w-xl text-sm leading-6 text-ink/75">
                Zik Pass now demonstrates a consumer-friendly onboarding funnel: simple questions,
                automatic pass delivery after confirmation, visible cooling-off, and a one-click
                verification step on a dummy betting-site vendor.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist"
                  href="/wallet"
                >
                  Get Zik Pass
                </Link>
                <a
                  className="rounded-full bg-ink/8 px-5 py-3 text-sm font-medium text-ink"
                  href="#learn-more"
                >
                  Find out more
                </a>
              </div>
            </div>
            <div className="rounded-[24px] bg-ink p-5 text-mist">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime">
                Verification pipeline
              </p>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-mist/85">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-xs">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </SurfaceCard>

        <div className="grid gap-6">
          <SurfaceCard title="Surfaces" subtitle="Each view maps directly to an MVP responsibility.">
            <div className="space-y-3">
              <Link className="block rounded-2xl bg-ink/5 p-4 hover:bg-ink/10" href="/wallet">
                <p className="font-heading text-lg font-medium">Get Zik Pass</p>
                <p className="text-sm text-ink/70">
                  Launch the guided question flow, receive the pass, and wait through cooling-off.
                </p>
              </Link>
              <Link className="block rounded-2xl bg-ink/5 p-4 hover:bg-ink/10" href="/issuer">
                <p className="font-heading text-lg font-medium">Issuer admin</p>
                <p className="text-sm text-ink/70">
                  Inspect intake records, monitor cooling-off, and issue credentials.
                </p>
              </Link>
              <Link className="block rounded-2xl bg-ink/5 p-4 hover:bg-ink/10" href="/verifier">
                <p className="font-heading text-lg font-medium">Dummy betting vendor</p>
                <p className="text-sm text-ink/70">
                  Trigger a single verification step and grant or deny access locally.
                </p>
              </Link>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Known prototype limits">
            <ul className="space-y-2 text-sm text-ink/75">
              <li>No real credit bureau or banking integrations.</li>
              <li>No revocation list or issuer callback for verification.</li>
              <li>No production-grade wallet storage or shared-device abuse prevention.</li>
              <li>No true zero-knowledge proof over a hidden date of birth.</li>
            </ul>
          </SurfaceCard>
        </div>
      </main>
    </AppShell>
  );
}
