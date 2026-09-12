import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  distDir: process.env.ZIK_NEXT_DIST_DIR ?? ".next"
};

export default nextConfig;
