import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/.venv/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
  ]),
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      complexity: ["error", 10],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  {
    files: ["*.config.{js,mjs,cjs}", "scripts/**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/*/src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react-icons",
                "react-icons/*",
                "@heroicons/*",
                "@tabler/icons-react",
                "@phosphor-icons/*",
                "@untitledui/icons*",
              ],
              message: "Use lucide-react so the prototype has one consistent icon family.",
            },
          ],
        },
      ],
    },
  },
  prettier,
);
