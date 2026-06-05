import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['logging-middleware'],
  experimental: {
    externalDir: true
  }
};

export default nextConfig;
