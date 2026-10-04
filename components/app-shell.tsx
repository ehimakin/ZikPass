import type { ReactNode } from "react";
import clsx from "clsx";

export function AppShell({ children, currentPath }: { children: ReactNode; currentPath?: string }) {
  const showHeroBackground = ["/", "/wallet", "/onboarding", "/dashboard/store/verify", "/issuer"].includes(currentPath ?? "");
  return <div className={clsx("relative min-h-screen", showHeroBackground ? "bg-[#070b12] text-mist" : "bg-mist text-ink")}>
      {showHeroBackground ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_#1a2740_0%,_#0e1726_44%,_#070b12_78%,_#04060a_100%)]"
        />
      ) : (
        <div className="absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(circle_at_top_left,_rgba(215,241,113,0.66),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(201,242,123,0.38),_transparent_34%),linear-gradient(180deg,_#fbfff1_0%,_#f4f7ee_42%,_#eef2e6_100%)]" />
      )}
    <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</div>
  </div>;
}
