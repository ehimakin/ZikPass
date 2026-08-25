"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ZikLogoLockup } from "@/components/zik-logo";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/", label: "Overview" },
  { href: "/wallet", label: "Wallet" },
  { href: "/verify", label: "Retail verify" },
  { href: "/store", label: "Store demo" }
];

export function AppShell({
  children,
  currentPath
}: {
  children: ReactNode;
  currentPath?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const scrollIdleTimer = useRef<number | null>(null);
  const showHeroBackground =
    currentPath === "/" ||
    currentPath === "/wallet" ||
    currentPath === "/onboarding" ||
    currentPath === "/store" ||
    currentPath === "/verify" ||
    currentPath === "/issuer";

  useEffect(() => {
    function handleScroll() {
      setHeaderVisible(window.scrollY <= 8);

      if (scrollIdleTimer.current) {
        window.clearTimeout(scrollIdleTimer.current);
      }

      scrollIdleTimer.current = window.setTimeout(() => {
        setHeaderVisible(true);
      }, 240);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollIdleTimer.current) {
        window.clearTimeout(scrollIdleTimer.current);
      }
    };
  }, []);

  return (
    <div className={clsx("relative min-h-screen", showHeroBackground ? "bg-[#070b12] text-mist" : "bg-mist text-ink")}>
      {showHeroBackground ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_#1a2740_0%,_#0e1726_44%,_#070b12_78%,_#04060a_100%)]"
        />
      ) : (
        <div className="absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(circle_at_top_left,_rgba(215,241,113,0.66),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(201,242,123,0.38),_transparent_34%),linear-gradient(180deg,_#fbfff1_0%,_#f4f7ee_42%,_#eef2e6_100%)]" />
      )}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 sm:px-6 lg:px-8">
        <header
          className={clsx(
            "fixed inset-x-0 top-0 z-40 transition-[opacity,transform] duration-200 ease-out",
            headerVisible || menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-25"
          )}
        >
          <div className="mx-auto w-full max-w-7xl px-5 pt-6 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center">
                <ZikLogoLockup tone={showHeroBackground ? "light" : "dark"} subdued />
              </Link>
              <button
                aria-label="Open site menu"
                className={clsx(
                  "inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium transition",
                  showHeroBackground
                    ? "border-white/15 bg-white/[0.04] text-mist/80 hover:border-white/30 hover:bg-white/[0.08]"
                    : "border-ink/10 bg-[#f4f7ee] text-ink hover:bg-[#ebf0df]"
                )}
                onClick={() => setMenuOpen(true)}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.22em]">Menu</span>
                <span className="flex flex-col gap-1">
                  <span className={clsx("block h-[1.5px] w-4 rounded-full", showHeroBackground ? "bg-mist/70" : "bg-ink")} />
                  <span className={clsx("block h-[1.5px] w-4 rounded-full", showHeroBackground ? "bg-mist/70" : "bg-ink")} />
                  <span className={clsx("block h-[1.5px] w-4 rounded-full", showHeroBackground ? "bg-mist/70" : "bg-ink")} />
                </span>
              </button>
            </div>
          </div>
        </header>
        <div aria-hidden="true" className="h-[106px] shrink-0" />
        {children}
      </div>

      {menuOpen ? (
        <div
          className={clsx(
            "fixed inset-0 z-50 backdrop-blur-md",
            showHeroBackground
              ? "bg-[#04060a]/88"
              : "bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.16),rgba(14,23,38,0.6)_56%)] backdrop-blur-sm"
          )}
          onClick={() => setMenuOpen(false)}
        >
          <Link
            href="/"
            className="absolute left-1/2 top-[150px] z-10 -translate-x-1/2"
            onClick={() => setMenuOpen(false)}
          >
            <ZikLogoLockup tone={showHeroBackground ? "light" : "dark"} subdued />
          </Link>
          <div className="flex min-h-screen items-start justify-center px-4 pb-4 pt-[210px] sm:px-6 sm:pb-6 sm:pt-[210px]">
            <div
              className={clsx(
                "mt-[40px] w-full max-w-sm rounded-[28px] p-2",
                showHeroBackground
                  ? "border border-white/10 bg-white/[0.03]"
                  : "border border-white/70 bg-white/96 shadow-[0_30px_90px_rgba(14,23,38,0.22)]"
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-end gap-4 px-2 pt-2">
                <button
                  aria-label="Close site menu"
                  className={clsx(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full text-lg",
                    showHeroBackground ? "text-mist/70 hover:text-mist" : "border border-ink/10 bg-[#f4f7ee] text-ink"
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="grid gap-1 p-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "rounded-2xl px-4 py-3.5 text-sm transition",
                      showHeroBackground
                        ? currentPath === item.href
                          ? "bg-white/10 text-mist"
                          : "text-mist/65 hover:bg-white/[0.06] hover:text-mist"
                        : currentPath === item.href
                          ? "border border-ink bg-ink text-mist"
                          : "border border-ink/8 bg-[#f7faee] text-ink hover:bg-[#edf3df]"
                    )}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
