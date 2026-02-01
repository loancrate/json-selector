import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import jest from "eslint-plugin-jest";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "src/__generated__/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unnecessary-type-constraint": "warn",
      "@typescript-eslint/no-redundant-type-constituents": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "all",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrors: "all",
        },
      ],
      "@typescript-eslint/require-await": "off",
      "no-console": "warn",
    },
  },
  {
    files: ["**/*.test.ts"],
    ...jest.configs["flat/recommended"],
    ...jest.configs["flat/style"],
  },
];
