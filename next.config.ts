import type { NextConfig } from "next";
import "./src/env"; // 빌드 시 환경변수 검증

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return ['/admin/:path*', '/api/auth/:path*', '/api/study/:path*'].map((source) => ({
      source,
      headers: [
        { key: 'Cache-Control', value: 'private, no-store' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    }));
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
