"use client";

import { useEffect, useState } from "react";
import { markPwaInstalled } from "@/lib/client/wallet-client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaHandoffResponse {
  pwaStartUrl: string;
  customSchemeUrl?: string;
}

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Run development cleanup after hydration rather than rendering an inline
    // nonce-bearing script, whose DOM attributes differ after browser parsing.
    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then(async registrations => {
        await Promise.all(registrations.filter(registration =>
          registration.active && new URL(registration.active.scriptURL).pathname === "/sw.js"
        ).map(registration => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.filter(key => key.startsWith("zikpass-")).map(key => caches.delete(key)));
        }
      }).catch(() => {
        // Cleanup is best effort when browser storage is unavailable.
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation remains available without a service worker.
    });
  }, []);

  return null;
}

export function PwaInstallButton({
  className = "rounded-full bg-ink px-6 py-3 text-sm font-semibold text-mist",
  label = "Install Zik Pass",
  enrollmentId,
  onInstalled
}: {
  className?: string;
  label?: string;
  enrollmentId?: string;
  onInstalled?: () => void;
}) {
  const [nativeApp, setNativeApp] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setNativeApp(navigator.userAgent.includes("ZikNative/1"));
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const handoffToken = new URLSearchParams(window.location.search).get("handoff_token");

    if (handoffToken && isAppleMobileBrowser()) {
      document.querySelector('link[rel="manifest"]')?.remove();
    }

    setIsInstalled(standalone || iosStandalone);
    if (standalone || iosStandalone) {
      void markPwaInstalled();
      onInstalled?.();
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
      setMessage("Zik Pass added to this device. Open it from your home screen.");
      void markPwaInstalled();
      onInstalled?.();
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [onInstalled]);

  async function install() {
    if (isInstalled) {
      setMessage("Zik Pass is already added to this device. Open it from your home screen.");
      return;
    }

    let pwaStartUrl: string | null = null;
    if (enrollmentId) {
      try {
        const response = await fetch("/api/mobile/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId })
        });
        const data = (await response.json()) as PwaHandoffResponse | { error?: string };
        if (!response.ok) {
          throw new Error((data as { error?: string }).error ?? "Unable to prepare the device handoff.");
        }

        if (nativeApp) {
          const nativeLink = (data as PwaHandoffResponse).customSchemeUrl;
          if (!nativeLink?.startsWith("zik://handoff?token=")) throw new Error("The native activation link is unavailable.");
          window.location.assign(nativeLink);
          return;
        }
        pwaStartUrl = (data as PwaHandoffResponse).pwaStartUrl;
        const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (manifestLink) {
          const token = new URL(pwaStartUrl, window.location.origin).searchParams.get("handoff_token");
          if (token) {
            manifestLink.href = `/api/pwa/manifest?handoff_token=${encodeURIComponent(token)}`;
          }
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to prepare the device handoff.");
        return;
      }
    }

    if (!installPrompt) {
      setMessage(
        "The wallet link is ready. Open your browser Share or menu button, choose Add to Home Screen or Install app, then launch Zik Pass from the new icon."
      );
      if (pwaStartUrl) {
        window.history.replaceState({}, "", pwaStartUrl);
      }
      return;
    }

    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setMessage(
      choice.outcome === "accepted"
        ? pwaStartUrl
          ? "Zik Pass is being installed. Open it from the new home-screen icon to finish saving your pass."
          : "Zik Pass is being installed on this device."
        : "Installation was cancelled."
    );
  }

  return (
    <div className="grid gap-2">
      <button
        className={`${className} ${isInstalled ? "border-[#69b889] bg-[#69b889] text-white" : ""}`}
        onClick={() => void install()}
        type="button"
      >
        {nativeApp ? "Save to Zik app" : isInstalled ? "Zik Pass added to device" : label}
      </button>
      {message ? (
        <p aria-live="polite" className="text-xs leading-5 text-ink/58">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function isAppleMobileBrowser(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
