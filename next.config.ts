import type { NextConfig } from "next";
import withPWAImport from "@ducanh2912/next-pwa";

const withPWA = withPWAImport({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  output: "standalone",
};

export default withPWA(nextConfig);