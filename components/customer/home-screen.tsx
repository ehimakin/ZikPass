"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Route } from "next";
import { loadWalletState } from "@/lib/client/wallet-client";
import { ButtonLink, Card, SectionHeading } from "@/components/customer/ui";
import { PinIcon, ShieldIcon, CheckIcon, PassIcon } from "@/components/customer/icons";
import { HomePassOverview } from "@/components/customer/home-pass-overview";
import type { WalletState } from "@/lib/shared/types";
import heroImage from "@/public/hero-zikpass-warm.png";

/** Desktop video backdrop, with the original artwork on smaller screens. */
export function HomeHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    const update = () => setEnabled(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const pauseUntilIdle = () => {
      clearTimeout(idleTimer);
      video.pause();
      if (manuallyPaused || document.hidden) return;
      idleTimer = setTimeout(() => {
        if (!disposed && !document.hidden) void video.play().catch(() => {});
      }, 750);
    };

    window.addEventListener("mousemove", pauseUntilIdle, { passive: true });
    window.addEventListener("scroll", pauseUntilIdle, { passive: true, capture: true });
    window.addEventListener("wheel", pauseUntilIdle, { passive: true });
    document.addEventListener("visibilitychange", pauseUntilIdle);
    pauseUntilIdle();

    return () => {
      disposed = true;
      clearTimeout(idleTimer);
      video.pause();
      window.removeEventListener("mousemove", pauseUntilIdle);
      window.removeEventListener("scroll", pauseUntilIdle, true);
      window.removeEventListener("wheel", pauseUntilIdle);
      document.removeEventListener("visibilitychange", pauseUntilIdle);
    };
  }, [enabled, manuallyPaused]);

  return (
    <>
      <Image
        src={heroImage}
        alt=""
        priority
        sizes="(min-width: 1024px) 100vw, (max-width: 361px) 709px, (max-width: 472px) 197vw, 927px"
        className="zk-home-hero-image"
      />
      {enabled && (
        <>
          <video
            ref={videoRef}
            className="zk-home-hero-video"
            src="/13061609-hd_1920_1080_60fps.mp4"
            muted
            loop
            playsInline
            aria-hidden="true"
          />
          <button
            type="button"
            className="zk-home-video-toggle"
            onClick={() => setManuallyPaused((paused) => !paused)}
          >
            {manuallyPaused ? "Play background video" : "Pause background video"}
          </button>
        </>
      )}
    </>
  );
}

export function HomeScreen({ price }: { price: string }) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [walletFailed, setWalletFailed] = useState(false);
  const hasPass = Boolean(wallet?.credential);

  useEffect(() => {
    let disposed = false;
    const refresh = () => loadWalletState()
      .then((state) => { if (!disposed) { setWallet(state); setWalletFailed(false); } })
      .catch(() => { if (!disposed) setWalletFailed(true); });
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { disposed = true; window.removeEventListener("focus", refresh); };
  }, []);

  return (
    <>
      <div className="flex min-h-[var(--zk-home-hero-spacer)] items-center justify-center py-6">
        <HomePassOverview wallet={wallet} failed={walletFailed} />
      </div>

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
            <ButtonLink href={(hasPass ? "/pass" : "/find") as Route} size="lg">
              {hasPass ? "Open My Pass" : <>Get Zik Pass &nbsp;&middot;&nbsp; <span className="text-[#d3bb53]">{price}</span></>}
            </ButtonLink>
          </div>
          {!hasPass && (
            <ButtonLink href={"/pass" as Route} variant="ghost" size="lg">
              I already have a pass
            </ButtonLink>
          )}
        </div>
        <p className="mt-9 text-center text-[13px] text-[var(--zk-text-soft)]">
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
