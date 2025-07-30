import type { NextConfig } from "next";

const nextConfig = {
  experimental: {
    // This is the recommended fix for libraries that cause build issues in the Next.js server environment.
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

module.exports = nextConfig;
