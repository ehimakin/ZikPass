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
    title: "The Zero-Knowledge online ID",
    description:
      "Zik Pass gives users a reusable Over-18 credential, then lets vendors verify it locally without exposing identity.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#10203a_0%,_#1f4356_42%,_#2d5c53_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_22%_24%,_rgba(215,241,113,0.28),_transparent_32%),radial-gradient(circle_at_78%_18%,_rgba(105,225,200,0.22),_transparent_26%),radial-gradient(circle_at_68%_78%,_rgba(248,200,180,0.16),_transparent_34%)]"
  },
  {
    id: "step-1",
    eyebrow: "Get started",
    title: "Start your Zik Pass",
    description: "Click “Get Zik Pass” to begin proving you’re over 18.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#0f1a2a_0%,_#213150_46%,_#305966_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_20%_24%,_rgba(215,241,113,0.24),_transparent_32%),radial-gradient(circle_at_78%_70%,_rgba(105,225,200,0.18),_transparent_30%)]"
  },
  {
    id: "step-2",
    eyebrow: "Step 1",
    stepNumber: "Step 1",
    title: "Confirm you’re a real account holder",
    description:
      "We’ll send a small refundable transaction to your bank with a unique code. Check your banking app and enter the code to continue. This proves you’re in control of a real adult account.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#0d1722_0%,_#173b47_48%,_#20615c_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_18%_26%,_rgba(105,225,200,0.24),_transparent_30%),radial-gradient(circle_at_80%_24%,_rgba(215,241,113,0.18),_transparent_24%)]"
  },
  {
    id: "step-3",
    eyebrow: "Step 2",
    stepNumber: "Step 2",
    title: "Quick security check on your device",
    description:
      "Unlock your device with Face ID, fingerprint, or passcode. This makes sure it’s really you completing the process.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#121825_0%,_#2b3156_42%,_#31436c_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_18%_72%,_rgba(248,200,180,0.22),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(105,225,200,0.18),_transparent_30%)]"
  },
  {
    id: "step-4",
    eyebrow: "Step 3",
    stepNumber: "Step 3",
    title: "We verify your eligibility",
    description:
      "Behind the scenes, Zik checks for signs of real adult financial activity. We don’t see your transactions, balance, or identity, only whether you meet the criteria.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#0f1b24_0%,_#23425a_44%,_#356a5f_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_20%_26%,_rgba(215,241,113,0.18),_transparent_28%),radial-gradient(circle_at_76%_68%,_rgba(248,200,180,0.18),_transparent_30%)]"
  },
  {
    id: "step-5",
    eyebrow: "Waiting period",
    title: "Short waiting period",
    description:
      "Your Zik Pass activates after a brief delay. This gives you time to spot and stop anything unexpected.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#1a1521_0%,_#2d304e_40%,_#305962_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_24%_24%,_rgba(248,200,180,0.22),_transparent_26%),radial-gradient(circle_at_82%_24%,_rgba(105,225,200,0.16),_transparent_28%)]"
  },
  {
    id: "step-6",
    eyebrow: "Pass delivery",
    title: "You receive your Zik Pass",
    description:
      "Your secure Over-18 pass is created and stored on your device. No ID and no personal data are shared.",
    backgroundClassName:
      "bg-[linear-gradient(135deg,_#101e2f_0%,_#25415b_45%,_#46655d_100%)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_24%_72%,_rgba(215,241,113,0.22),_transparent_30%),radial-gradient(circle_at_80%_16%,_rgba(105,225,200,0.22),_transparent_28%)]"
  },
  {
    id: "step-7",
    eyebrow: "Ready to use",
    title: "Use it anywhere",
    description:
      "When a site asks if you’re over 18, tap “Verify with Zik” and approve the request. The site only sees: “Yes, this user is over 18.” Nothing else.",
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
                Get Zik Pass
              </Link>
              <a
                className="rounded-full bg-white/12 px-5 py-3 text-sm font-medium text-mist backdrop-blur hover:bg-white/18"
                href="#learn-more"
              >
                Find out more
              </a>
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
