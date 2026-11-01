import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const nextConfig: NextConfig = {
  typedRoutes: true,
  devIndicators: false,
  outputFileTracingIncludes: { "/api/wallet/apple/demo": ["./assets/apple-wallet/*.png"] },
  distDir: process.env.ZIK_NEXT_DIST_DIR ?? ".next"
};

export default function config(phase: string): NextConfig {
  // Keep the temporary browser key out of production builds and tracked files.
  const keyFile = join(process.cwd(), "DELETE_BEFORE_PRODUCTION_CREDENTIALS/google-maps.env");
  if (phase === PHASE_DEVELOPMENT_SERVER && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && existsSync(keyFile)) {
    const key = readFileSync(keyFile, "utf8").match(/^NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=([^\r\n]+)$/m)?.[1]?.trim();
    if (key) return { ...nextConfig, env: { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: key } };
  }
  return nextConfig;
}
