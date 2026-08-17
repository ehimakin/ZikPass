"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
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
  label = "Install ZikPass"
}: {
  className?: string;
  label?: string;
}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone || iosStandalone);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
      setMessage("ZikPass is now installed on this device.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function install() {
    if (isInstalled) {
      setMessage("ZikPass is already installed on this device.");
      return;
    }

    if (!installPrompt) {
      setMessage(
        "Install the web wallet from your browser menu: choose Add to Home Screen on iPhone or Install app on Android."
      );
      return;
    }

    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setMessage(
      choice.outcome === "accepted"
        ? "ZikPass is being installed on this device."
        : "Installation was cancelled."
    );
  }

  return (
    <div className="grid gap-2">
      <button className={className} onClick={() => void install()} type="button">
        {isInstalled ? "ZikPass installed" : label}
      </button>
      {message ? (
        <p aria-live="polite" className="text-xs leading-5 text-ink/58">
          {message}
        </p>
      ) : null}
    </div>
  );
}
