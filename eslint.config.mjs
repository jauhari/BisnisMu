import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  {
    ignores: [".next/**", "node_modules/**", "out/**", "dist/**", "next-env.d.ts", "prisma/migrations/**"]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals"),

  {
    rules: {
      // The codebase leans on `any` heavily at the API boundary. Flagging every one of
      // them would bury real findings, so it is a warning to be worked down rather than
      // an error that blocks the build today.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      // Money is BigInt throughout; a stray `==` between a bigint and a number would
      // coerce silently.
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["warn", { allow: ["error", "warn"] }]
    }
  },

  {
    files: ["tests/**/*.ts"],
    rules: {
      // Test doubles deliberately implement partial interfaces and cast across them.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off"
    }
  }
);
