/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['logging-middleware'],
  experimental: {
    externalDir: true
  },
  webpack: (config) => {
    config.devtool = false; // Disable sourcemaps to drastically save memory
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {}
};

export default nextConfig;
