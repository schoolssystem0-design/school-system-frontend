import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /**
   * Vercel + Railway default hosts are cross-site, so session/CSRF cookies cannot be set on the API
   * domain from the browser. Proxy /api/v1 to Railway so the app talks to the same origin as the UI.
   * Set API_PROXY_TARGET on Vercel (e.g. https://….up.railway.app) and NEXT_PUBLIC_API_BASE_URL=/api/v1.
   */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
    if (!target) {
      return [];
    }
    return [{ source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` }];
  },
};

export default nextConfig;
