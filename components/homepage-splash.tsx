"use client";

import { useEffect, useState } from "react";
import { ZikLogoLockup } from "@/components/zik-logo";

const cookieName = "zikpass-home-splash-seen";

/** Restore the original brief brand animation and time-based revisit policy. */
export function HomepageSplash({ suppressSeconds }: { suppressSeconds: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const lastSeen = Number(document.cookie.split("; ").find((value) => value.startsWith(`${cookieName}=`))?.split("=")[1]);
    if (Number.isFinite(lastSeen) && Date.now() - lastSeen < suppressSeconds * 1000) return;
    // Reduced-motion visitors go straight to the usable homepage.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      document.cookie = `${cookieName}=${Date.now()}; Max-Age=31536000; Path=/; SameSite=Lax`;
      setVisible(false);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [suppressSeconds]);

  if (!visible) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-[radial-gradient(ellipse_at_top,_#1a2740_0%,_#0e1726_44%,_#070b12_78%,_#04060a_100%)]">
      <div className="animate-hero-fade px-6"><ZikLogoLockup stacked tone="light" /></div>
    </div>
  );
}
