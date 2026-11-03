import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR connections from 127.0.0.1
  allowedDevOrigins: ['127.0.0.1'],
  
  // Live garage state should not be prerendered or cached.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
