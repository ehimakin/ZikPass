"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { StatusPill } from "@/components/status-pill";

interface HeroSlide {
  id: string;
  eyebrow: string;
  stepNumber?: string;
  title: string;
  description: string;
  backgroundClassName: string;
  glowClassName: string;
}

const slides: HeroSlide[] = [
  {
    id: "hero",
    eyebrow: "Overview",
    title: "Show your ID once. Keep it offline.",
    description:
      "ZikPass turns an approved in-person age check into a reusable signed 18+ credential stored on the customer device.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#10203a_0%,_#1f4356_42%,_#2d5c53_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_22%_24%,_rgba(215,241,113,0.28),_transparent_32%),radial-gradient(circle_at_78%_18%,_rgba(105,225,200,0.22),_transparent_26%),radial-gradient(circle_at_68%_78%,_rgba(248,200,180,0.16),_transparent_34%)]"
  },
  {
    id: "step-1",
    eyebrow: "Retail card",
    title: "Scan the Zik retail QR",
    description:
      "The printed card is generic. Scanning it starts a fresh physical verification session on your phone.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#0f1a2a_0%,_#213150_46%,_#305966_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_20%_24%,_rgba(215,241,113,0.24),_transparent_32%),radial-gradient(circle_at_78%_70%,_rgba(105,225,200,0.18),_transparent_30%)]"
  },
  {
    id: "step-2",
    eyebrow: "Step 1",
    stepNumber: "Step 1",
    title: "Create a temporary customer QR",
    description:
      "Your phone creates a local holder key and shows a short-lived QR/code for this verification session only.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#0d1722_0%,_#173b47_48%,_#20615c_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_18%_26%,_rgba(105,225,200,0.24),_transparent_30%),radial-gradient(circle_at_80%_24%,_rgba(215,241,113,0.18),_transparent_24%)]"
  },
  {
    id: "step-3",
    eyebrow: "Step 2",
    stepNumber: "Step 2",
    title: "Show your physical ID in person",
    description:
      "A staff member checks your physical ID at the till. Zik does not upload, photograph, or store your ID.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#121825_0%,_#2b3156_42%,_#31436c_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_18%_72%,_rgba(248,200,180,0.22),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(105,225,200,0.18),_transparent_30%)]"
  },
  {
    id: "step-4",
    eyebrow: "Step 3",
    stepNumber: "Step 3",
    title: "Staff confirms 18+",
    description:
      "The authorised store verifier sends Zik the result: an adult completed the approved in-person age check.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#0f1b24_0%,_#23425a_44%,_#356a5f_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_20%_26%,_rgba(215,241,113,0.18),_transparent_28%),radial-gradient(circle_at_76%_68%,_rgba(248,200,180,0.18),_transparent_30%)]"
  },
  {
    id: "step-5",
    eyebrow: "Device binding",
    title: "Authenticate on this device",
    description:
      "The pass is issued to the holder public key created on the customer device. The issuer never needs the private key.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#1a1521_0%,_#2d304e_40%,_#305962_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_24%_24%,_rgba(248,200,180,0.22),_transparent_26%),radial-gradient(circle_at_82%_24%,_rgba(105,225,200,0.16),_transparent_28%)]"
  },
  {
    id: "step-6",
    eyebrow: "Pass delivery",
    title: "Receive your ZikPass",
    description:
      "Your wallet shows 18+ and In-person verified. The credential contains the attestation result, not your identity.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#101e2f_0%,_#25415b_45%,_#46655d_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_24%_72%,_rgba(215,241,113,0.22),_transparent_30%),radial-gradient(circle_at_80%_16%,_rgba(105,225,200,0.22),_transparent_28%)]"
  },
  {
    id: "step-7",
    eyebrow: "Secondary lane",
    title: "A secondary route is still available",
    description:
      "Users who cannot visit a participating retailer can choose a lower-assurance remote route.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#0b1a14_0%,_#123024_36%,_#1f4f3e_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_24%_22%,_rgba(215,241,113,0.24),_transparent_28%),radial-gradient(circle_at_76%_70%,_rgba(105,225,200,0.20),_transparent_30%)]"
  }
];

const SLIDE_INTERVAL_MS = 9625;

export function HeroSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  const activeSlide = slides[activeIndex];

  return (
    <section
      aria-label="Zik Pass overview slideshow"
      className={clsx(
        "relative left-1/2 right-1/2 mb-6 -ml-[50vw] -mr-[50vw] w-screen overflow-hidden text-mist transition-colors duration-700",
        activeSlide.backgroundClassName
      )}
    >
      <div className={clsx("absolute inset-0 transition-opacity duration-700", activeSlide.glowClassName)} />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 hidden w-[52%] bg-right-bottom bg-no-repeat opacity-80 lg:block"
        style={{
          backgroundImage: "url('/homepage-device-bg.svg')",
          backgroundSize: "contain"
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,_rgba(14,23,38,0.82)_0%,_rgba(14,23,38,0.56)_42%,_rgba(14,23,38,0.16)_100%)]" />

      <div className="relative mx-auto flex min-h-[420px] max-w-7xl items-end px-6 py-8 sm:min-h-[520px] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="flex flex-col justify-end">
          <div className="max-w-2xl">
            <div key={activeSlide.id} className="animate-hero-fade">
              <StatusPill tone="good">{activeSlide.eyebrow}</StatusPill>
              {activeSlide.stepNumber ? (
                <p className="mt-4 font-mono text-5xl font-semibold leading-none tracking-[0.16em] text-lime/85 sm:text-6xl">
                  {activeSlide.stepNumber}
                </p>
              ) : null}
              <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-mist sm:text-5xl lg:text-6xl">
                {activeSlide.title}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-mist/80 sm:text-base">
                {activeSlide.description}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-lime px-5 py-3 text-sm font-semibold text-ink"
                href="/wallet"
              >
                Start physical flow
              </Link>
              <Link
                className="rounded-full bg-white/12 px-5 py-3 text-sm font-medium text-mist backdrop-blur hover:bg-white/18"
                href="/verify"
              >
                Retail verifier
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  aria-label={`Go to ${slide.eyebrow}`}
                  className={clsx(
                    "h-2.5 rounded-full transition-all",
                    index === activeIndex ? "w-10 bg-lime" : "w-4 bg-white/30 hover:bg-white/45"
                  )}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
