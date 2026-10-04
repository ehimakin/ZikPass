"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import clsx from "clsx";

/** Page content layout. Site navigation is mounted once in the root layout. */
export function CustomerShell({ children, title, back, hero, immersive = false }: {
  children: ReactNode;
  active: "home" | "find" | "wallet" | "pass" | "help" | "vault" | "about";
  title?: string;
  back?: { href: Route | string; label: string };
  hero?: ReactNode;
  immersive?: boolean;
}) {
  return <div className={clsx("zk-surface flex flex-col", hero && "zk-home-surface", immersive && "zk-immersive-surface")}>
    {hero && <div className="zk-home-hero pointer-events-none fixed inset-x-0 top-14 z-0 overflow-hidden">{hero}</div>}
    <main className={clsx("relative z-10 mx-auto w-full flex-1", immersive ? "max-w-none px-0 pb-0 pt-0" : "max-w-[560px] px-4 pb-8", !immersive && (hero ? "pt-0" : "pt-4"))}>
      {(back || title) && <div className="relative flex items-center gap-3 px-4 py-3 text-sm text-[var(--zk-text-soft)]">
        {back && <Link href={back.href as Route} className="font-semibold underline underline-offset-4">← {back.label}</Link>}
        {title && <span className="ml-auto font-semibold">{title}</span>}
      </div>}
      {children}
    </main>
  </div>;
}
