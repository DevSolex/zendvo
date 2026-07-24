import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:5000/api/:path*",
      },
      {
        source: "/avatars/:path*",
        destination: "http://127.0.0.1:5000/avatars/:path*",
      },
    ];
  },
};

export default nextConfig;
