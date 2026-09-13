"use client";

import { useEffect, useState } from "react";
import { ZikLogoLockup } from "@/components/zik-logo";

const cookieName = "zikpass-home-splash-seen";
const replayEventName = "zikpass:replay-home-splash";

export function replayHomepageSplash() {
  window.dispatchEvent(new Event(replayEventName));
}

/** Restore the original brief brand animation and time-based revisit policy. */
export function HomepageSplash({ suppressSeconds }: { suppressSeconds: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const hideSplash = () => {
      document.cookie = `${cookieName}=${Date.now()}; Max-Age=31536000; Path=/; SameSite=Lax`;
      setVisible(false);
    };
    const showSplash = () => {
      if (timer) window.clearTimeout(timer);
      setVisible(true);
      timer = window.setTimeout(hideSplash, 700);
    };

    window.addEventListener(replayEventName, showSplash);

    const lastSeen = Number(document.cookie.split("; ").find((value) => value.startsWith(`${cookieName}=`))?.split("=")[1]);
    const recentlySeen = Number.isFinite(lastSeen) && Date.now() - lastSeen < suppressSeconds * 1000;
    // Reduced-motion visitors still go straight to the usable homepage unless
    // they explicitly click the brand to replay the splash.
    if (!recentlySeen && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) showSplash();

    return () => {
      window.removeEventListener(replayEventName, showSplash);
      if (timer) window.clearTimeout(timer);
    };
  }, [suppressSeconds]);

  if (!visible) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-[radial-gradient(ellipse_at_top,_#272727_0%,_#171717_44%,_#0b0b0b_78%,_#060606_100%)]">
      <div className="animate-hero-fade px-6"><ZikLogoLockup stacked tone="light" /></div>
    </div>
  );
}
