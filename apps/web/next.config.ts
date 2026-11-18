import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cip/ui", "@cip/shared"],
  // Console da equipe CIP em gestao.<domínio> (local: gestao.localhost:3000).
  allowedDevOrigins: [
    "gestao.localhost",
    ...(process.env.NEXTAUTH_URL ? [new URL(process.env.NEXTAUTH_URL).hostname] : []),
  ],
  async rewrites() {
    const apiOrigin = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
    return [{ source: "/api/backend/:path*", destination: `${apiOrigin}/:path*` }];
  },
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
      ],
    }];
  },
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
