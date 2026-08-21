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
      className="fixed inset-0 z-[100] grid place-items-center bg-[radial-gradient(circle_at_top_left,_rgba(215,241,113,0.64),_transparent_42%),linear-gradient(180deg,_#fbfff1_0%,_#f4f7ee_48%,_#eef2e6_100%)]"
      role="status"
    >
      <div className="animate-hero-fade px-6">
        <ZikLogoLockup stacked subdued />
      </div>
    </div>
  );
}
