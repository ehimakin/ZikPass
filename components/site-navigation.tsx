"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import clsx from "clsx";
import { HomeIcon, PinIcon, PassIcon, VaultIcon } from "@/components/customer/icons";

import { ZikLogoMark } from "@/components/zik-logo";
import { CustomerMenu } from "@/components/customer/customer-menu";
import { OfflineBanner } from "@/components/customer/offline-banner";
import { SupportChat } from "@/components/customer/support/support-chat";

import { replayHomepageSplash } from "@/components/homepage-splash";

interface NavItem {
  href: Route;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
}

const NAV: NavItem[] = [
  { href: "/home" as Route, label: "Home", Icon: HomeIcon },
  { href: "/find" as Route, label: "Find a store", Icon: PinIcon },
  { href: "/wallet" as Route, label: "Wallet", Icon: PassIcon },
  { href: "/vault" as Route, label: "Vault", Icon: VaultIcon }
];

export function SiteNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const shellRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const active = pathname === "/home" ? "home" : pathname === "/find" ? "find"
    : /^\/(wallet|pass|card|shop|get-pass|account-recovery)(\/|$)/.test(pathname) || pathname.startsWith("/dashboard/customer/wallet") || pathname.startsWith("/dashboard/customer/recovery") ? "wallet"
    : pathname.startsWith("/vault") || pathname === "/dashboard/customer" ? "vault" : "";
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const updateHeight = () => shellRef.current?.style.setProperty("--zk-bottom-nav-height", `${nav.getBoundingClientRect().height}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  return <div ref={shellRef} className="zk-surface min-h-[100dvh]" style={{ paddingBottom: "var(--zk-bottom-nav-height, 64px)" }}>
      <a
        href="#zk-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-[var(--zk-text-on-ink)]"
       data-local-edit={process.env.NODE_ENV === "development" ? "ve-58a0b92fcc86-1" : undefined}>
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--zk-line)] bg-[var(--zk-canvas)]">
        <div className="mx-auto flex h-14 w-full max-w-[560px] items-center gap-3 px-4">
            <Link
              href={"/home" as Route}
              className="flex items-center gap-2"
              aria-label="Zik Pass home"
              onClick={(event) => {
                if (pathname !== "/home") return;
                event.preventDefault();
                replayHomepageSplash();
              }}
            >
              <ZikLogoMark padlock className="zk-logo-float h-7 w-7 shrink-0" />
              <span className="text-[16px] font-extrabold tracking-tight text-[#28623c]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-58a0b92fcc86-2" : undefined}>Zik</span>
            </Link>
          <span className="ml-auto hidden rounded-full bg-[var(--zk-sunken)] px-2.5 py-1 text-[11px] font-semibold text-[var(--zk-text-soft)] sm:block" data-local-edit={process.env.NODE_ENV === "development" ? "ve-6cd485f25855-1" : undefined}>Early Access</span>
          <div className="ml-auto shrink-0 sm:ml-0">
            <CustomerMenu items={[
              { label: "Zik Suite", children: [
                { href: "/get-pass" as Route, label: "Zik Pass" },
                { href: "/vault" as Route, label: "Zik Vault" },
                { href: "/id" as Route, label: "Zik iD" },
                { href: "/validate" as Route, label: "Zik Validate" }
              ] },
              { href: "/home#how-it-works" as Route, label: "How it works" },
              { href: "/about" as Route, label: "Why Zik?" }
            ]} pathname={pathname} />
          </div>
        </div>
        <OfflineBanner />
      </header>

<div id="zk-main" tabIndex={-1}>{children}</div>
<SupportChat />
      <nav
        ref={navRef}
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--zk-line)] bg-[var(--zk-card)] shadow-[var(--zk-shadow-nav)]"
      >
        <ul className="mx-auto flex w-full max-w-[560px] items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === ("/home" as Route) && active === "home") ||
              (item.href === ("/find" as Route) && active === "find") ||
              (item.href === ("/wallet" as Route) && active === "wallet") ||
              (item.href === ("/vault" as Route) && active === "vault");
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors",
                    isActive
                      ? "text-[#d3bb53]"
                      : "text-[var(--zk-text-faint)] hover:text-black hover:opacity-100 focus-visible:text-black focus-visible:opacity-100"
                  )}
                >
                  <item.Icon
                    className={clsx(
                      "h-[22px] w-[22px]",
                      isActive && "[&_*]:stroke-[1.9]"
                    )}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
</div>;
}
