import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jestPlugin from "eslint-plugin-jest";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Ignore build output and Next.js internals
  globalIgnores([".next/**", "dist/**"]),

  // Jest rules for test files
  {
    files: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
    ...jestPlugin.configs["flat/recommended"],
    rules: {
      ...jestPlugin.configs["flat/recommended"].rules,
      "jest/require-top-level-describe": "error",
    },
  },
]);

export default eslintConfig;
