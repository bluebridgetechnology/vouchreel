import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// Hardening that is safe for every page. A full script CSP needs per-request nonces with
// Next's inline bootstrap scripts, so only the directives that do not depend on that are set.
const baseCsp = ["base-uri 'self'", "object-src 'none'", "form-action 'self'"];

const commonHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera and microphone are needed by the public collect page (in-browser recording)
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=()' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  // Produces .next/standalone for the Docker runner stage (see Dockerfile).
  output: 'standalone',

  async headers() {
    return [
      { source: '/:path*', headers: commonHeaders },
      // Everything except the collect form refuses to be framed (clickjacking)
      {
        source: '/:path((?!collect(?:/|$)).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: [...baseCsp, "frame-ancestors 'none'"].join('; ') },
        ],
      },
      // The collection form is designed to be embedded as an iframe on customer sites
      {
        source: '/collect/:path*',
        headers: [{ key: 'Content-Security-Policy', value: [...baseCsp, 'frame-ancestors *'].join('; ') }],
      },
    ];
  },
};

export default nextConfig;
