import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces .next/standalone for the Docker runner stage (see Dockerfile).
  output: 'standalone',
};

export default nextConfig;
