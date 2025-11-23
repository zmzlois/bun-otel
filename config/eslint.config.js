// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/lib/**",
      "**/.turbo/**",
      "**/*.config.js",
      "**/build.ts",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/test*.ts",
      "**/test*.js",
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
    },
  }
);
