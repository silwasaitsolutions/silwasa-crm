import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@silwasa/shared"],
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  // The browser only ever talks to the web origin; /api/v1 is proxied to the Express API.
  // This keeps auth cookies first-party (no cross-site cookie problems on Vercel + Render).
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
