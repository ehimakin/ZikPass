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
  { href: "/store", label: "Store demo" },
  { href: "/issuer", label: "Issuer" },
  { href: "/verifier", label: "Verifier" }
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
  const showHeroBackground = currentPath === "/" || currentPath === "/wallet";

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
    <div className={clsx("relative min-h-screen text-ink", showHeroBackground ? "bg-white" : "bg-mist")}>
      {showHeroBackground ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-0 h-screen bg-white"
          style={{
            backgroundImage: "url('/Zik%20Branded%20Hero.png')",
            backgroundPosition: "center top",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% auto"
          }}
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
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
            <div className="rounded-[32px] border-2 border-white/50 bg-transparent px-4 py-4 transition-colors duration-200 hover:border-white focus-within:border-white">
              <div className="flex items-center justify-between gap-4">
                <Link href="/" className="flex items-center">
                  <ZikLogoLockup subdued />
                </Link>
                <button
                  aria-label="Open site menu"
                  className="inline-flex items-center gap-3 rounded-full border border-ink/10 bg-[#f4f7ee] px-4 py-3 text-sm font-medium text-ink hover:bg-[#ebf0df]"
                  onClick={() => setMenuOpen(true)}
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
                    Menu
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="block h-[2px] w-4 rounded-full bg-ink" />
                    <span className="block h-[2px] w-4 rounded-full bg-ink" />
                    <span className="block h-[2px] w-4 rounded-full bg-ink" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <div aria-hidden="true" className="h-[106px] shrink-0" />
        {children}
      </div>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.16),rgba(14,23,38,0.6)_56%)] backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        >
          <Link
            href="/"
            className="absolute left-1/2 top-[150px] z-10 -translate-x-1/2"
            onClick={() => setMenuOpen(false)}
          >
            <ZikLogoLockup subdued />
          </Link>
          <div className="flex min-h-screen items-start justify-center px-4 pb-4 pt-[210px] sm:px-6 sm:pb-6 sm:pt-[210px]">
            <div
              className="mt-[40px] w-full max-w-sm rounded-[34px] border border-white/70 bg-white/96 p-6 shadow-[0_30px_90px_rgba(14,23,38,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-end gap-4">
                <button
                  aria-label="Close site menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-[#f4f7ee] text-lg text-ink"
                  onClick={() => setMenuOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="mt-6 grid gap-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "rounded-[24px] border px-4 py-4 text-sm transition",
                      currentPath === item.href
                        ? "border-ink bg-ink text-mist"
                        : "border-ink/8 bg-[#f7faee] text-ink hover:bg-[#edf3df]"
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
