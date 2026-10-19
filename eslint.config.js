import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  },
  tseslint.configs.recommended,
  {
    files: ["packages/github/src/**/*.ts", "packages/postgres/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@osva/db",
              message:
                "Public connectors must not import OSVA monorepo internals.",
            },
            {
              name: "@osva/domain",
              message:
                "Public connectors must not import OSVA monorepo internals.",
            },
          ],
          patterns: [
            {
              group: ["@osva/*"],
              message:
                "Public connectors must not import OSVA monorepo internals.",
            },
          ],
        },
      ],
    },
  },
);
