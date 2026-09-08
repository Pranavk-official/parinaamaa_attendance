import type { NextConfig } from "next";
import withPWAImport from "@ducanh2912/next-pwa";

const withPWA = withPWAImport({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

// No "output: standalone": the image ships node_modules and runs `next start`,
// which Next refuses to combine with a standalone build.
const nextConfig: NextConfig = {};

export default withPWA(nextConfig);