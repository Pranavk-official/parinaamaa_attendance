import type { NextConfig } from "next";
import withPWAImport from "@ducanh2912/next-pwa";

const withPWA = withPWAImport({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

// No "output: standalone": the image ships node_modules and runs `next start`,
// which Next refuses to combine with a standalone build.
const nextConfig: NextConfig = {
  // Headers Next's PWA guide asks for: the worker must never be cached, or
  // clients keep running a stale one.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);