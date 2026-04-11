"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ZikLogoLockup } from "@/components/zik-logo";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/", label: "Overview" },
  { href: "/wallet", label: "Wallet" },
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
  const showWalletBackground = currentPath === "/wallet";

  return (
    <div
      className={clsx("relative min-h-screen text-ink", showWalletBackground ? "bg-[#eef2e6]" : "bg-mist")}
      style={
        showWalletBackground
          ? {
              backgroundImage:
                "linear-gradient(180deg, rgba(251,255,241,0.74) 0%, rgba(244,247,238,0.80) 40%, rgba(238,242,230,0.88) 100%), url('/homepage-device-bg.svg')",
              backgroundPosition: "center top",
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% auto"
            }
          : undefined
      }
    >
      {!showWalletBackground ? (
        <div className="absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(circle_at_top_left,_rgba(215,241,113,0.66),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(201,242,123,0.38),_transparent_34%),linear-gradient(180deg,_#fbfff1_0%,_#f4f7ee_42%,_#eef2e6_100%)]" />
      ) : null}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-10 rounded-[32px] border border-white/80 bg-white/78 px-4 py-4 shadow-panel backdrop-blur">
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
        </header>
        {children}
      </div>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,_rgba(215,241,113,0.16),rgba(14,23,38,0.6)_56%)] backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        >
          <div className="flex min-h-screen items-start justify-end p-4 sm:p-6">
            <div
              className="w-full max-w-sm rounded-[34px] border border-white/70 bg-white/96 p-6 shadow-[0_30px_90px_rgba(14,23,38,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4">
                <ZikLogoLockup subdued />
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
