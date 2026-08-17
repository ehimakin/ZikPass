import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PwaRegistration } from "@/components/pwa-install-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zik Pass MVP",
  description: "Privacy-first age verification prototype for sprint one.",
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
    title: "ZikPass"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
