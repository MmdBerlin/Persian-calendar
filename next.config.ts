import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Capacitor / offline APK builds.
  // `standalone` output is not compatible with static hosting inside the APK.
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
