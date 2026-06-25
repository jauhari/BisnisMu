import type { NextConfig } from "next";
import * as Sentry from "@sentry/nextjs";

import { securityHeaders } from "./src/presentation/security/security-headers";

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  serverExternalPackages: ["better-auth", "@better-auth/core", "@better-auth/prisma-adapter", "@better-auth/kysely-adapter", "better-call", "kysely"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), "better-auth", "@better-auth/core", "@better-auth/prisma-adapter", "@better-auth/kysely-adapter", "better-call", "kysely"];
    }
    return config;
  },
  typedRoutes: false,
  // Reduce client bundle size for common heavy libs
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@tanstack/react-table", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [...securityHeaders],
      },
    ];
  }
};

export default process.env.SENTRY_DSN
  ? Sentry.withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : nextConfig;
