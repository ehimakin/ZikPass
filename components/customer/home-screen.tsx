"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Route } from "next";
import { loadWalletState } from "@/lib/client/wallet-client";
import { ButtonLink, Card, SectionHeading } from "@/components/customer/ui";
import { PinIcon, ShieldIcon, CheckIcon, PassIcon } from "@/components/customer/icons";
import heroImage from "@/public/hero-zikpass-warm.png";

/** The fixed hero image behind /home. Passed to CustomerShell's `hero` slot. */
export function HomeHero() {
  return (
    <Image
      src={heroImage}
      alt=""
      priority
      sizes="(max-width: 361px) 709px, (max-width: 472px) 197vw, 927px"
      className="zk-home-hero-image"
    />
  );
}

export function HomeScreen({ price }: { price: string }) {
  const [hasPass, setHasPass] = useState<boolean | null>(null);

  useEffect(() => {
    loadWalletState()
      .then((state) => setHasPass(Boolean(state.credential)))
      .catch(() => setHasPass(false));
  }, []);

  return (
    <>
      {/* Keep the original section position so it slightly overlaps the enlarged hero. */}
      <div aria-hidden="true" className="h-[var(--zk-home-hero-spacer)]" />

      <div className="relative -mx-4 min-h-[60vh] space-y-6 rounded-t-[var(--zk-r-xl)] bg-[var(--zk-canvas)] px-4 pb-10 pt-6 shadow-[0_-10px_30px_rgba(14,23,38,0.08)]">
      <section>
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--zk-text-faint)]">
          Age verification, done once
        </p>
        <h1 className="mt-2 text-[30px] font-extrabold leading-[1.15] tracking-tight text-[var(--zk-text)]">
          <span className="text-[#d3bb53]">Prove your age online</span> without sharing your ID*.
        </h1>
        <p className="mt-8 text-[15px] leading-relaxed text-[var(--zk-text-soft)]">
          *Verify in participating stores. Then use your pass anywhere
          online. Only sharing that you&rsquo;re over 18.
        </p>
        <p className="mt-5 text-[15px] leading-relaxed text-[var(--zk-text-soft)]">
          That&apos;s zero knowledge. That&apos;s Zik.
        </p>

        <div className="mt-10 space-y-2.5">
          <div className="zk-lifted-pass-button">
            <ButtonLink href={"/find" as Route} size="lg">
              Get Zik Pass &nbsp;&middot;&nbsp; <span className="text-[#d3bb53]">{price}</span>
            </ButtonLink>
          </div>
          {hasPass ? (
            <ButtonLink href={"/pass" as Route} variant="secondary" size="lg">
              Open my pass
            </ButtonLink>
          ) : (
            <ButtonLink href={"/pass" as Route} variant="ghost" size="lg">
              I already have a pass
            </ButtonLink>
          )}
        </div>
        <p className="mt-3 text-center text-[13px] text-[var(--zk-text-soft)]">
          Bought a card in store?{" "}
          <a href="/card" className="font-semibold text-[var(--zk-text)] underline">
            Activate it
          </a>
        </p>
      </section>

      <section>
        <SectionHeading>How it works</SectionHeading>
        <ol className="space-y-2.5">
          {[
            {
              Icon: PinIcon,
              title: "Visit a Zik store",
              body: "Find your nearest store and bring photo ID."
            },
            {
              Icon: CheckIcon,
              title: "Show ID to a clerk",
              body: "A quick in-person check. Your ID is not scanned or kept."
            },
            {
              Icon: PassIcon,
              title: "Get your pass",
              body: "A signed pass is saved to this device. Reuse it online for a year."
            }
          ].map((step, index) => (
            <li key={step.title}>
              <Card className="flex items-start gap-3.5 p-4">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-[var(--zk-accent)]">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[15px] font-bold text-[var(--zk-text)]">
                    {step.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-[var(--zk-text-soft)]">
                    {step.body}
                  </span>
                </span>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--zk-positive)]" />
            <div>
              <p className="text-[14px] font-bold text-[var(--zk-text)]">What a site receives</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--zk-text-soft)]">
                Only a yes/no confirmation that you are over 18, plus a one-time signed
                token for that check. No name, date of birth, photo or document number is
                shared. This prototype does not use biometrics or a zero-knowledge proof.
              </p>
            </div>
          </div>
        </Card>
      </section>
      </div>
    </>
  );
}
