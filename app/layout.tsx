import { LocalVisualEditor } from "@/devtools/visual-editor/local-visual-editor";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { GlobalErrorReporter } from "@/components/global-error-reporter";
import { PwaRegistration } from "@/components/pwa-install-button";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope"
});

export const metadata: Metadata = {
  title: "Zik Pass",
  description:
    "Get a reusable age pass in person, then prove you are old enough online without sharing your ID. Prototype.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/zikpass-192.svg", type: "image/svg+xml" },
      { url: "/icons/zikpass-512.svg", type: "image/svg+xml" }
    ],
    apple: "/icons/zikpass-192.svg"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zik Pass"
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        {process.env.NODE_ENV === "development" ? (
          <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                return Promise.all(registrations.filter(function(r) {
                  return r.active && new URL(r.active.scriptURL).pathname === '/sw.js';
                }).map(function(r) { return r.unregister(); }));
              }).then(function() {
                return caches.keys().then(function(keys) {
                  return Promise.all(keys.filter(function(key) { return key.startsWith('zikpass-'); }).map(function(key) { return caches.delete(key); }));
                });
              }).catch(function() {});
            }
          ` }} />
        ) : <PwaRegistration />}
        <GlobalErrorReporter />
        {children}
        {process.env.NODE_ENV === "development" && <LocalVisualEditor />}
      </body>
    </html>
  );
}
