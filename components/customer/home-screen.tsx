"use client";

import { createHeroPlayback } from "@/lib/client/hero-playback";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { loadWalletState } from "@/lib/client/wallet-client";
import { ProductFamily } from "@/components/customer/product-family";
import { HomePassOverview } from "@/components/customer/home-pass-overview";
import type { WalletState } from "@/lib/shared/types";
import { ZikGlyph } from "@/components/zik-logo";
import { ZikPassCard } from "@/components/customer/zik-pass-card";
import heroImage from "@/public/hero-zikpass-warm.png";
import physicalHeroImage from "@/public/hero-zik-card-lock.png";

const HERO_SLIDES = [
  {
    word: "",
    support: "Prove your age. Keep your identity to yourself.",
  },
  {
    word: "Pass",
    support: "Your proof of age, ready when a participating website asks.",
  },
  {
    word: "Vault",
    support: "Your documents. Encrypted on your device. Early Access.",
  },
  {
    word: "ID",
    support: "Your identity, on your terms. Coming Soon.",
  },
  {
    word: "Validate",
    support: "Independent document verification. Coming Soon.",
  },
] as const;

const HERO_ROULETTE_TRANSITION_MS = 490;

/**
 * Vertically wipes between words in place, odometer-style, for the hero header.
 * A duplicate of the first word is appended so the loop can keep wiping in one
 * direction; the caller snaps back to index 0 without a transition once that
 * duplicate row is reached.
 */
function HeroRouletteWord({
  words,
  rouletteIndex,
  transitionEnabled,
}: {
  words: readonly string[];
  rouletteIndex: number;
  transitionEnabled: boolean;
}) {
  const loopWords = [...words, words[0]];
  return (
    <span className="zk-roulette">
      <span
        className="zk-roulette-track"
        style={{ transform: `translateY(-${rouletteIndex}em)`, transition: transitionEnabled ? undefined : "none" }}
      >
        {loopWords.map((word, index) => (
          <span className="zk-roulette-row" key={index} aria-hidden={index === rouletteIndex ? undefined : true}>
            {word}
          </span>
        ))}
      </span>
    </span>
  );
}

/** The lime-green phone artwork shared by fixed customer-page heroes. */
export function PhoneHero() {
  return (
    <Image
      src={heroImage}
      alt=""
      priority
      sizes="(min-width: 1024px) 100vw, (max-width: 361px) 709px, (max-width: 472px) 197vw, 927px"
      className="zk-home-hero-image"
    />
  );
}

/** Responsive video backdrop with artwork as the playback/reduced-motion fallback. */
export function HomeHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playback = useRef<ReturnType<typeof createHeroPlayback> | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const update = () => setEnabled(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;

    const controller = createHeroPlayback(video);
    playback.current = controller;
    const visibility = () => controller.setHidden(document.hidden);
    window.addEventListener("mousemove", controller.movement, { passive: true });
    window.addEventListener("scroll", controller.movement, { passive: true, capture: true });
    window.addEventListener("wheel", controller.movement, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      controller.dispose();
      playback.current = null;
      window.removeEventListener("mousemove", controller.movement);
      window.removeEventListener("scroll", controller.movement, true);
      window.removeEventListener("wheel", controller.movement);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);

  const toggleVideoPlayback = () => playback.current?.toggle();

  return (
    <>
      <Image
        src={physicalHeroImage}
        alt=""
        priority
        sizes="100vw"
        className="zk-home-hero-image"
      />
      {enabled && (
        <>
          <video
            ref={videoRef}
            className="zk-home-hero-video"
            style={{ opacity: hasPlayed ? 1 : 0 }}
            onPlaying={() => setHasPlayed(true)}
            onError={() => setHasPlayed(false)}
            preload="metadata"
            src="/Hero%20Videos/Splash%20rough%201.mp4"
            muted
            loop
            playsInline
            aria-hidden="true"
            onClick={toggleVideoPlayback}
          />
        </>
      )}
    </>
  );
}

export function HomeScreen({ price }: { price: string }) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [walletFailed, setWalletFailed] = useState(false);
  const [privacyRevealed, setPrivacyRevealed] = useState(false);
  const privacyRef = useRef<HTMLElement>(null);
  const hasPass = Boolean(wallet?.credential);

  const [rouletteIndex, setRouletteIndex] = useState(0);
  const [rouletteTransition, setRouletteTransition] = useState(true);
  const [heroAutoplay, setHeroAutoplay] = useState(true);
  const [heroManualNonce, setHeroManualNonce] = useState(0);
  const heroSlide = rouletteIndex % HERO_SLIDES.length;
  const isValidateSlide = HERO_SLIDES[heroSlide].word === "Validate";
  const isVaultSlide = HERO_SLIDES[heroSlide].word === "Vault";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setHeroAutoplay(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!heroAutoplay) return;
    let slideTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let remaining = 8000;
    let deadline = 0;
    let disposed = false;
    const resume = () => {
      if (disposed || document.hidden) return;
      deadline = performance.now() + remaining;
      slideTimer = setTimeout(() => {
        slideTimer = undefined;
        setRouletteIndex((current) => current + 1);
        remaining = 8000;
        resume();
      }, remaining);
    };
    const pauseUntilIdle = () => {
      clearTimeout(idleTimer);
      if (slideTimer !== undefined) {
        remaining = Math.max(0, deadline - performance.now());
        clearTimeout(slideTimer);
        slideTimer = undefined;
      }
      if (!document.hidden) idleTimer = setTimeout(resume, 750);
    };
    window.addEventListener("mousemove", pauseUntilIdle, { passive: true });
    window.addEventListener("scroll", pauseUntilIdle, { passive: true, capture: true });
    window.addEventListener("wheel", pauseUntilIdle, { passive: true });
    document.addEventListener("visibilitychange", pauseUntilIdle);
    pauseUntilIdle();
    return () => {
      disposed = true;
      clearTimeout(slideTimer);
      clearTimeout(idleTimer);
      window.removeEventListener("mousemove", pauseUntilIdle);
      window.removeEventListener("scroll", pauseUntilIdle, true);
      window.removeEventListener("wheel", pauseUntilIdle);
      document.removeEventListener("visibilitychange", pauseUntilIdle);
    };
  }, [heroAutoplay, heroManualNonce]);

  useEffect(() => {
    if (rouletteIndex !== HERO_SLIDES.length) return;
    const timer = setTimeout(() => {
      setRouletteTransition(false);
      setRouletteIndex(0);
    }, HERO_ROULETTE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [rouletteIndex]);

  useEffect(() => {
    if (rouletteTransition) return;
    const raf = requestAnimationFrame(() => setRouletteTransition(true));
    return () => cancelAnimationFrame(raf);
  }, [rouletteTransition]);

  const goToHeroSlide = (index: number) => {
    setRouletteTransition(true);
    setRouletteIndex(index);
    setHeroManualNonce((n) => n + 1);
  };

  useEffect(() => {
    let disposed = false;
    const refresh = () => loadWalletState()
      .then((state) => { if (!disposed) { setWallet(state); setWalletFailed(false); } })
      .catch(() => { if (!disposed) setWalletFailed(true); });
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { disposed = true; window.removeEventListener("focus", refresh); };
  }, []);

  useEffect(() => {
    const scene = privacyRef.current;
    if (!scene) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setPrivacyRevealed(true);
    }, { threshold: 0.45 });
    observer.observe(scene);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="zk-cinematic-home">
      <section className="zk-scene zk-scene-hero" aria-labelledby="zik-hero-title">
        <div className="zk-scene-inner zk-hero-copy">
          <p className="zk-scene-kicker" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-1" : undefined}>{"Your age. Your business."}</p>
          <h1 id="zik-hero-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-2" : undefined}>{"Zik "}<HeroRouletteWord words={HERO_SLIDES.map((slide) => slide.word)} rouletteIndex={rouletteIndex} transitionEnabled={rouletteTransition} /><br/><em data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-2" : undefined}>{"*zero knowledge"}</em></h1>
          <div className="zk-hero-support-stack">
            {HERO_SLIDES.map((slide, index) => (
              <p
                key={slide.word || "blank"}
                className={`zk-hero-support ${index === heroSlide ? "is-active" : ""}`}
                aria-hidden={index === heroSlide ? undefined : true}
                data-local-edit={index === 0 && process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-3" : undefined}
              >
                {slide.support}
              </p>
            ))}
          </div>
          <div className="zk-hero-actions">
            <Link className={`zk-editorial-cta zk-editorial-cta--primary${isVaultSlide && hasPass ? " !rounded-none" : ""}`} href={(isValidateSlide ? "/validate" : isVaultSlide ? "/vault" : hasPass ? "/pass" : "/get-pass") as Route}>{isValidateSlide ? "Explore Zik Validate" : isVaultSlide ? (hasPass ? "Go to Vault" : "Get a Vault") : hasPass ? "Open my pass" : <>Get Zik Pass <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-34" : undefined}>· Free in Early Access</span></>}</Link>
            <Link className="zk-editorial-cta zk-editorial-cta--text" href={(isValidateSlide ? "/validate#how-it-works" : isVaultSlide ? "/vault/how-it-works" : "#how-it-works") as Route}>{isValidateSlide ? "How validation works" : isVaultSlide ? "How Vault works" : "How it works"} <span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-4" : undefined}>→</span></Link>
          </div>
          <div className="zk-hero-dots" role="tablist" aria-label="Hero slides">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.word || "blank"}
                type="button"
                role="tab"
                aria-selected={index === heroSlide}
                aria-label={`Show slide ${index + 1}`}
                className={`zk-hero-dot ${index === heroSlide ? "is-active" : ""}`}
                onClick={() => goToHeroSlide(index)}
              />
            ))}
          </div>
        </div>
        <a href="#how-it-works" className="zk-hero-scroll-cue" aria-label="Explore more about Zik" onClick={event => {
          event.preventDefault();
          const section = document.getElementById("how-it-works");
          if (!section) return;
          section.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          section.focus({ preventScroll: true });
        }}>
          <svg viewBox="0 0 100 100" width="79.2" height="79.2" fill="none" aria-hidden="true" focusable="false">
            <g stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
              <ZikGlyph />
              <path d="M30 75.25L40.1 85.35Q50 95.25 59.9 85.35L70 75.25" />
            </g>
          </svg>
        </a>
        <p className="zk-interaction-note" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-5" : undefined}></p>
      </section>

      <section ref={privacyRef} className={`zk-scene zk-scene-privacy ${privacyRevealed ? "is-revealed" : ""}`} aria-labelledby="privacy-title">
        <div className="zk-scene-inner zk-privacy-layout">
          <div><p className="zk-scene-kicker" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-6" : undefined}>{"Why do sites ask for your name..."}</p><h2 id="privacy-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-7" : undefined}>{"When they only need"}<br/>{"your age?"}</h2></div>
          <div className="zk-identity-stack" aria-label="Identity details Zik does not need to share">
            {["Name", "Date of birth", "Passport", "Selfie"].map((label, index)=><span key={label} style={{"--token-index":index} as CSSProperties}>{label}</span>)}
          </div>
          <div className="zk-answer-lockup"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-8" : undefined}>{"Zik answers this with"}</p><strong data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-9" : undefined}>Over 18 <i>✓</i></strong><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-10" : undefined}>{"Only the answer a participating site needs."}</span></div>
        </div>
      </section>

      <section id="how-it-works" tabIndex={-1} className="zk-scene zk-scene-physical" aria-labelledby="physical-title">
        <Image src={physicalHeroImage} alt="Zik Pass on a phone beside the lime physical Zik Card" className="zk-scene-device-image" sizes="100vw" priority />
        <div className="zk-scene-inner zk-physical-copy">
          <p className="zk-scene-kicker" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-11" : undefined}>{"Prefer a physical card?"}</p>
          <h2 id="physical-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-12" : undefined} >{"Zik verifies your age once, physically. In the real world."}<br/><em>{"By keeping your identity offline, we help you stay anonymous online."}</em></h2>
          <ol className="zk-editorial-steps"><li><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-13" : undefined}>01</span><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-14" : undefined}>Show ID once<br/><small>Checked by a participating store. Not retained.</small></p></li><li><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-15" : undefined}>02</span><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-16" : undefined}>Link your phone<br/><small>Scan your card to get started.</small></p></li><li><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-17" : undefined}>03</span><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-18" : undefined}>{"Keep it with you"}<br/><small>{"Ready for participating services."}</small></p></li></ol>
        </div>
      </section>

      <section className="zk-scene zk-scene-pass" aria-labelledby="pass-title">
        <div className="zk-scene-inner zk-pass-layout">
          <div className="zk-pass-copy"><p className="zk-scene-kicker" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-19" : undefined}>The pass</p><h2 id="pass-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-20" : undefined}>{"Buy a physical card in store"}<br/><em>{"or a digital pass in the app"}</em></h2><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-21" : undefined}>Choose what works for you.</p></div>
          <div className="zk-pass-products">
            <figure className="zk-card-artwork">
              <Link href="/shop" aria-label="Shop Zik Cards" className="block rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-white">
                <ZikPassCard />
              </Link>
              <figcaption data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-38" : undefined}>Physical card · Purchased at participating stores</figcaption>
            </figure>
            <div className="zk-pass-object"><HomePassOverview wallet={wallet} failed={walletFailed}/></div>
          </div>
        </div>
      </section>

      <section className="zk-scene zk-scene-control" aria-labelledby="control-title">
        <div className="zk-scene-inner zk-control-layout">
          <div><p className="zk-scene-kicker" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-22" : undefined}>You stay in control</p><h2 id="control-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-23" : undefined}>Share the answer.<br/><em>Not the evidence.</em></h2></div>
          <div className="zk-disclosure-demo"><div><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-24" : undefined}>Website asks</span><strong data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-25" : undefined}>Are you over 18?</strong></div><div className="zk-disclosure-line"/><div className="zk-disclosure-result"><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-26" : undefined}>Zik returns</span><strong data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-27" : undefined} style={{"color":"#ffffff"}}>{"Yes "}<i>{"✓"}</i></strong></div><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-28" : undefined} style={{"color":"#ffffff","backgroundColor":"#90bf26"}}>{"Name · date of birth · photo ID remain private"}</p></div>
          <div className="zk-final-action"><Link className="zk-editorial-cta zk-editorial-cta--lime" href={(hasPass ? "/pass" : "/get-pass") as Route}>{hasPass ? "Open my pass" : "Get Zik Pass"} <span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-29" : undefined}>→</span></Link>{!hasPass?<Link href={"/pass" as Route}>I already have a pass</Link>:null}</div>
        </div>
      </section>

      <section className="relative bg-[var(--zk-canvas)] px-4 py-16 pb-32" aria-labelledby="product-family-title">
        <div className="mx-auto max-w-[528px]">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-30" : undefined}>The wider Zik platform</p>
          <h2 id="product-family-title" className="mt-3 text-[30px] font-extrabold leading-tight tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-31" : undefined}>Zik starts with Zik Pass.</h2>
          <p className="mb-6 mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-32" : undefined}>One pass today. More possibilities ahead.</p>
          <ProductFamily price={price} />
          <Link href={"/ecosystem" as Route} className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full text-sm font-bold underline underline-offset-4">Explore the Zik ecosystem <span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-fbec76acddfc-33" : undefined}>→</span></Link>
        </div>
      </section>
    </div>
  );
}
