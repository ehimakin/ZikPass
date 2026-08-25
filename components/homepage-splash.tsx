"use client";

import { useEffect, useState } from "react";
import { ZikLogoLockup } from "@/components/zik-logo";

const splashCookieName = "zikpass-home-splash-seen";
const splashDurationMs = 700;

export function HomepageSplash({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.cookie = `${splashCookieName}=${Date.now()}; Max-Age=31536000; Path=/; SameSite=Lax`;
    const timer = window.setTimeout(() => setVisible(false), splashDurationMs);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  if (!enabled || !visible) {
    return null;
  }

  return (
    <div
      aria-label="ZikPass"
      className="fixed inset-0 z-[100] grid place-items-center bg-[radial-gradient(ellipse_at_top,_#1a2740_0%,_#0e1726_44%,_#070b12_78%,_#04060a_100%)]"
      role="status"
    >
      <div className="animate-hero-fade px-6">
        <ZikLogoLockup stacked tone="light" />
      </div>
    </div>
  );
}
