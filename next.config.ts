import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  devIndicators: false,
  outputFileTracingIncludes: { "/api/wallet/apple/demo": ["./assets/apple-wallet/*.png"] },
  distDir: process.env.ZIK_NEXT_DIST_DIR ?? ".next"
};

export default nextConfig;
