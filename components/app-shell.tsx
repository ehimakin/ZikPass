import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import clsx from "clsx";

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
  return (
    <div className={clsx("min-h-screen bg-mist text-ink")}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,_rgba(215,241,113,0.55),_transparent_48%),radial-gradient(circle_at_top_right,_rgba(105,225,200,0.45),_transparent_42%),linear-gradient(180deg,_#fffdf6_0%,_#f4f6f0_100%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-10 rounded-full border border-white/70 bg-white/75 px-4 py-3 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link href="/" className="font-heading text-xl font-semibold tracking-tight">
                Zik Pass
              </Link>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/60">
                Zero-knowledge-inspired age verification
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-full px-4 py-2 text-sm transition",
                    currentPath === item.href
                      ? "bg-ink text-mist"
                      : "bg-ink/5 text-ink/80 hover:bg-ink/10"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
