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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>
        <PwaRegistration />
        <GlobalErrorReporter />
        {children}
      </body>
    </html>
  );
}
