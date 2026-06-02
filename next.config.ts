import type { NextConfig } from "next";

import { securityHeaders } from "./src/presentation/security/security-headers";

const nextConfig: NextConfig = {
  experimental: { nodeMiddleware: true },
  serverExternalPackages: ["better-auth", "@better-auth/core", "@better-auth/prisma-adapter", "@better-auth/kysely-adapter", "better-call", "kysely", "argon2"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), "better-auth", "@better-auth/core", "@better-auth/prisma-adapter", "@better-auth/kysely-adapter", "better-call", "kysely", "argon2"];
    }
    return config;
  },
  typedRoutes: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [...securityHeaders],
      },
    ];
  }
};

export default nextConfig;
