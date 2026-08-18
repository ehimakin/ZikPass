import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("handoff_token")?.trim();
  const startUrl = token
    ? `/wallet?source=pwa&handoff_token=${encodeURIComponent(token)}`
    : "/wallet?source=pwa";

  return NextResponse.json({
    name: "ZikPass",
    short_name: "ZikPass",
    description: "Your privacy-first digital age pass.",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#f4f7ee",
    theme_color: "#d7f171",
    icons: [
      {
        src: "/icons/zikpass-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable"
      },
      {
        src: "/icons/zikpass-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
