import type { NextConfig } from "next";

import { securityHeaders } from "./src/presentation/security/security-headers";

// Node.js middleware is stable since Next.js 15.5; the former
// `experimental.nodeMiddleware` flag is rejected as an unknown key.
// `runtime: "nodejs"` in middleware.ts is all that is required.
const nextConfig: NextConfig = {
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
