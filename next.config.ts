import type { NextConfig } from "next";

const isCapacitor = process.env.CAPACITOR_BUILD === 'true';

const nextConfig: NextConfig = {
  output: isCapacitor ? 'export' : undefined,
  images: isCapacitor ? { unoptimized: true } : undefined,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
