import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker / Cloud Run — produces .next/standalone
  output: "standalone",

  // Production hardening
  poweredByHeader: false,
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
