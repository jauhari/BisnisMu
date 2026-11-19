import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Coverage is measured on the pure business logic (domain engines +
      // application services), where unit tests are meaningful. Infrastructure
      // adapters and presentation are exercised by integration/e2e instead.
      include: [
        "src/features/**/domain/**/*.ts",
        "src/features/**/application/**/*.ts",
      ],
      exclude: ["**/*.types.ts", "**/*.test.ts"],
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
