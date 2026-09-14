"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { loadWalletState } from "@/lib/client/wallet-client";
import { HomePassOverview } from "@/components/customer/home-pass-overview";
import type { WalletState } from "@/lib/shared/types";
import heroImage from "@/public/hero-zikpass-warm.png";

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

/** Desktop video backdrop, with the original artwork on smaller screens. */
export function HomeHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manuallyPausedRef = useRef(false);
  const [enabled, setEnabled] = useState(false);

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
      if (manuallyPausedRef.current || document.hidden) return;
      idleTimer = setTimeout(() => {
        if (!disposed && !manuallyPausedRef.current && !document.hidden) void video.play().catch(() => {});
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
  }, [enabled]);

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    manuallyPausedRef.current = !manuallyPausedRef.current;
    if (manuallyPausedRef.current) video.pause();
    else void video.play().catch(() => {});
  };

  return (
    <>
      <PhoneHero />
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
          <p className="zk-scene-kicker">Zik Pass</p>
          <h1 id="zik-hero-title">Prove your age.<br/><em>Not your identity.</em></h1>
          <p className="zk-hero-support">Verify that you&rsquo;re over 18 without repeatedly handing sensitive websites your personal identity.</p>
          <div className="zk-hero-actions">
            <Link className="zk-editorial-cta zk-editorial-cta--primary" href={(hasPass ? "/pass" : "/find") as Route}>{hasPass ? "Open my pass" : <>Get ZikPass <span>{price}</span></>}</Link>
            <a className="zk-editorial-cta zk-editorial-cta--text" href="#how-it-works">How it works <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <p className="zk-interaction-note">The interface responds only when you do.</p>
      </section>

      <section ref={privacyRef} id="how-it-works" className={`zk-scene zk-scene-privacy ${privacyRevealed ? "is-revealed" : ""}`} aria-labelledby="privacy-title">
        <div className="zk-scene-inner zk-privacy-layout">
          <div><p className="zk-scene-kicker">The privacy problem</p><h2 id="privacy-title">They ask for<br/>your identity.</h2></div>
          <div className="zk-identity-stack" aria-label="Identity details Zik does not need to share">
            {["Name", "Date of birth", "Passport", "Selfie"].map((label, index)=><span key={label} style={{"--token-index":index} as CSSProperties}>{label}</span>)}
          </div>
          <div className="zk-answer-lockup"><p>Zik answers</p><strong>Over 18 <i>✓</i></strong><span>Nothing else leaves your pass.</span></div>
        </div>
      </section>

      <section className="zk-scene zk-scene-physical" aria-labelledby="physical-title">
        <Image src={heroImage} alt="Zik Pass on a phone after real-world verification" className="zk-scene-device-image" sizes="100vw" priority />
        <div className="zk-scene-inner zk-physical-copy">
          <p className="zk-scene-kicker">Physical verification</p>
          <h2 id="physical-title">Verified in the real world.<br/><em>Anonymous online.</em></h2>
          <ol className="zk-editorial-steps"><li><span>01</span><p>Show ID once<br/><small>Checked by a participating store. Not retained.</small></p></li><li><span>02</span><p>Bind your device<br/><small>Your private holder key stays with you.</small></p></li><li><span>03</span><p>Use it for a year<br/><small>Sites receive the answer, not your evidence.</small></p></li></ol>
        </div>
      </section>

      <section className="zk-scene zk-scene-pass" aria-labelledby="pass-title">
        <div className="zk-scene-inner zk-pass-layout">
          <div className="zk-pass-copy"><p className="zk-scene-kicker">The pass</p><h2 id="pass-title">Proof you own.<br/><em>Not data you surrender.</em></h2><p>Signed. Device-bound. Reusable.</p></div>
          <div className="zk-pass-object"><HomePassOverview wallet={wallet} failed={walletFailed}/></div>
        </div>
      </section>

      <section className="zk-scene zk-scene-control" aria-labelledby="control-title">
        <div className="zk-scene-inner zk-control-layout">
          <div><p className="zk-scene-kicker">You stay in control</p><h2 id="control-title">Share the answer.<br/><em>Not the evidence.</em></h2></div>
          <div className="zk-disclosure-demo"><div><span>Website asks</span><strong>Are you over 18?</strong></div><div className="zk-disclosure-line"/><div className="zk-disclosure-result"><span>Zik returns</span><strong>Yes <i>✓</i></strong></div><p>Name · date of birth · photo ID remain private</p></div>
          <div className="zk-final-action"><Link className="zk-editorial-cta zk-editorial-cta--lime" href={(hasPass ? "/pass" : "/find") as Route}>{hasPass ? "Open my pass" : "Get ZikPass"} <span aria-hidden="true">→</span></Link>{!hasPass?<Link href={"/pass" as Route}>I already have a pass</Link>:null}</div>
        </div>
      </section>
    </div>
  );
}
