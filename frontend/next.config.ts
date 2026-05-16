import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["cesium", "@cesium/engine", "@cesium/widgets"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        http: false,
        https: false,
      };
    }
    return config;
  },
};

export default nextConfig;
