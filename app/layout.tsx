import { SiteNavigation } from "@/components/site-navigation";
import { LocalVisualEditor } from "@/devtools/visual-editor/local-visual-editor";
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

// Middleware supplies a fresh CSP nonce for every document request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zik Pass",
  description:
    "Your proof of age, in your pocket. Explore ZikPass, physical Zik Cards and your private document Vault.",
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
        <SiteNavigation>{children}</SiteNavigation>
        {process.env.NODE_ENV === "development" && process.env.ZIK_VISUAL_EDITOR !== "false" && <LocalVisualEditor />}
      </body>
    </html>
  );
}
