/* eslint-disable */
// PM2 ecosystem config — loads .env vars explicitly
require("dotenv").config({ path: __dirname + "/.env", override: true });

module.exports = {
  apps: [
    {
      name: "bisnismu",
      script: "node_modules/.bin/next",
      args: "dev --port 3333",
      cwd: __dirname,
      interpreter: "none",
      env: {
        NODE_ENV: "development",
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        SENTRY_DSN: process.env.SENTRY_DSN || "",
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
      },
    },
  ],
};
