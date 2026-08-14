import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";

const steps = [
  "A customer scans the generic Zik retail-card QR in a participating store.",
  "Zik creates a fresh physical verification session and the customer phone shows a short-lived QR/code.",
  "Store staff check the physical ID in person and submit an authorised 18+ attestation.",
  "Zik signs an in-person verified credential bound to the holder public key on that device.",
  "The wallet stores the ZikPass locally; a secondary remote route remains available when in-person verification is not possible."
];

export default function HomePage() {
  return (
    <AppShell currentPath="/">
      <HeroSlideshow />

      <main id="learn-more" className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <SurfaceCard
          title="Physical-first ZikPass issuance"
          subtitle="A retail age check becomes a reusable signed 18+ credential on the customer device."
          className="overflow-hidden"
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <StatusPill tone="good">Core principle</StatusPill>
              <h2 className="font-heading text-4xl font-semibold tracking-tight">
                Show your ID once. Keep it offline. Use ZikPass online.
              </h2>
              <p className="max-w-xl text-sm leading-6 text-ink/75">
                The primary lane captures a normal in-person age check at a participating retailer.
                Zik receives the authorised 18+ result, not a copy of the customer&apos;s ID, name,
                date of birth, address, or ID image.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist"
                  href="/wallet?flow=physical&store_id=zik-london-001&store_name=Zik%20Oxford%20Street&location_id=front-desk"
                >
                  Start in-store flow
                </Link>
                <Link
                  className="rounded-full bg-ink/8 px-5 py-3 text-sm font-medium text-ink"
                  href="/wallet?flow=remote"
                >
                  Remote verification
                </Link>
              </div>
            </div>
            <div className="rounded-[24px] bg-ink p-5 text-mist">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-lime">
                Physical issuance pipeline
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
                  Start the physical-first wallet flow or use the secondary remote lane.
                </p>
              </Link>
              <Link className="block rounded-2xl bg-ink/5 p-4 hover:bg-ink/10" href="/verify">
                <p className="font-heading text-lg font-medium">Retail verifier</p>
                <p className="text-sm text-ink/70">
                  Resolve a customer QR/code and submit an authorised in-person 18+ attestation.
                </p>
              </Link>
              <Link className="block rounded-2xl bg-ink/5 p-4 hover:bg-ink/10" href="/issuer">
                <p className="font-heading text-lg font-medium">Issuer admin</p>
                <p className="text-sm text-ink/70">
                  Inspect pending issuance records, monitor cooling-off, and sign credentials.
                </p>
              </Link>
              <Link className="block rounded-2xl bg-ink/5 p-4 hover:bg-ink/10" href="/verifier">
                <p className="font-heading text-lg font-medium">Dummy betting vendor</p>
                <p className="text-sm text-ink/70">
                  Trigger a challenge-response verification step and grant or deny access locally.
                </p>
              </Link>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Known prototype limits">
            <ul className="space-y-2 text-sm text-ink/75">
              <li>Retailer authentication and point-of-sale integration are mocked for the prototype.</li>
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
