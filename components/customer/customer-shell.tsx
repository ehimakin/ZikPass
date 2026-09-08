"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import clsx from "clsx";
import { HomeIcon, PinIcon, PassIcon, HelpIcon } from "@/components/customer/icons";
import { environmentBadgeLabel } from "@/lib/shared/demo-environment";
import { ZikLogoMark } from "@/components/zik-logo";
import { CustomerMenu } from "@/components/customer/customer-menu";
import { OfflineBanner } from "@/components/customer/offline-banner";
import { AffiliateLogoRails } from "@/components/customer/affiliate-logo-rails";

interface NavItem {
  href: Route;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
}

const NAV: NavItem[] = [
  { href: "/home" as Route, label: "Home", Icon: HomeIcon },
  { href: "/find" as Route, label: "Find a store", Icon: PinIcon },
  { href: "/pass" as Route, label: "My pass", Icon: PassIcon },
  { href: "/help" as Route, label: "Help", Icon: HelpIcon }
];

export function CustomerShell({
  children,
  active,
  title,
  back,
  hero
}: {
  children: ReactNode;
  active: "home" | "find" | "pass" | "help" | "about";
  /** Optional page title shown in the compact header. */
  title?: string;
  /** Optional back link target. */
  back?: { href: Route | string; label: string };
  /**
   * Optional full-bleed hero pinned below the header. It stays fixed while the
   * page content scrolls up over it. The page's own content must open with an
   * opaque panel so it covers the hero on scroll. Its slightly shorter
   * --zk-home-hero-spacer creates an intentional initial overlap.
   */
  hero?: ReactNode;
}) {
  const pathname = usePathname();
  const shellRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const updateHeight = () => shellRef.current?.style.setProperty("--zk-bottom-nav-height", `${nav.getBoundingClientRect().height}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shellRef} className={clsx("zk-surface flex min-h-[100dvh] flex-col", hero && "zk-home-surface")}>
      {hero ? (
        <div
          aria-hidden="true"
          className="zk-home-hero pointer-events-none fixed inset-x-0 top-14 z-0 overflow-hidden"
        >
          {hero}
        </div>
      ) : null}
      <a
        href="#zk-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-[var(--zk-text-on-ink)]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-[var(--zk-line)] bg-[var(--zk-canvas)]">
        <div className="mx-auto flex h-14 w-full max-w-[560px] items-center gap-3 px-4">
          {back ? (
            <Link
              href={back.href as Route}
              className="-ml-1 inline-flex items-center gap-1 rounded-full py-1.5 pl-1 pr-2 text-[14px] font-semibold text-[var(--zk-text-soft)] hover:bg-[var(--zk-sunken)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m15 5-7 7 7 7" />
              </svg>
              {back.label}
            </Link>
          ) : (
            <Link href={"/home" as Route} className="flex items-center gap-2" aria-label="Zik Pass home">
              <ZikLogoMark className="zk-logo-float h-7 w-7 shrink-0" />
              <span className="text-[16px] font-extrabold tracking-tight text-[var(--zk-text)]">
                Zik Pass
              </span>
            </Link>
          )}
          {title ? (
            <span className="ml-auto text-[13px] font-semibold text-[var(--zk-text-faint)]">
              {title}
            </span>
          ) : (
            <span className="ml-auto hidden rounded-full bg-[var(--zk-sunken)] sm:block px-2.5 py-1 text-[11px] font-semibold text-[var(--zk-text-soft)]">
              {environmentBadgeLabel()}
            </span>
          )}
          <div className={clsx("shrink-0", !title && "ml-auto sm:ml-0")}>
            <CustomerMenu items={NAV.map((item) => item.href === "/find" ? { href: "/about" as Route, label: "About" } : item)} pathname={pathname} />
          </div>
        </div>
        <OfflineBanner />
      </header>

      <main
        id="zk-main"
        className={clsx(
          "relative z-10 mx-auto w-full max-w-[560px] flex-1 px-4 pb-28",
          hero ? "pt-0" : "pt-4"
        )}
      >
        {children}
      </main>

      <AffiliateLogoRails />

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
              (item.href === ("/pass" as Route) && active === "pass") ||
              (item.href === ("/help" as Route) && active === "help");
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
    </div>
  );
}
