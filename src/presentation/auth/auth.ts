import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import argon2 from "argon2";

import { prisma } from "@/presentation/api/prisma";

/** Production + preview origins that better-auth should accept for CSRF. */
const trustedOrigins: string[] = [
  "https://bisnismu.net",
  "https://www.bisnismu.net",
  "http://localhost:3000",
];

// Include Vercel preview URL if available
if (process.env.VERCEL_URL) {
  trustedOrigins.push(`https://${process.env.VERCEL_URL}`);
}

export const auth = betterAuth({
  appName: "BisnisMu",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: false, // PgBouncer transaction pooling tidak support Prisma interactive transactions
  }),
  user: {
    modelName: "User",
  },
  session: {
    modelName: "Session",
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  account: {
    modelName: "AuthAccount",
  },
  verification: {
    modelName: "VerificationToken",
    fields: {
      value: "value",
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      hash: (password) => argon2.hash(password, { type: argon2.argon2id }),
      verify: ({ hash, password }) => argon2.verify(hash, password),
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
