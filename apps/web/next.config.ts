import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cip/ui", "@cip/shared"],
  // Console da equipe CIP em gestao.<domínio> (local: gestao.localhost:3000).
  allowedDevOrigins: ["gestao.localhost"],
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
