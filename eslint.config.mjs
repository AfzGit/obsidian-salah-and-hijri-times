import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    ignores: [
      "main.js",
      "node_modules/**",
      ".test-build/**",
      "another-implementation.tsx",
      "*.patch",
      "check-test-build-copy.nu",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*", "version-bump.mjs"],
        },
      },
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      // Tests run in Node's test runner, not inside Obsidian.
      "obsidianmd/no-nodejs-modules": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    files: ["version-bump.mjs"],
    rules: {
      // Build scripts run under Node, never inside Obsidian.
      "obsidianmd/no-nodejs-modules": "off",
    },
  },
]);
