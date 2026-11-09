# Release checklist — `@osva-ai/connector-snowflake`

**B4.9 source-only** until npm bootstrap. Workflow: [npm-release-snowflake.yml](../.github/workflows/npm-release-snowflake.yml).

- [ ] `pnpm --filter @osva-ai/connector-snowflake format:check`
- [ ] `pnpm --filter @osva-ai/connector-snowflake lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-snowflake test`
- [ ] `pnpm --filter @osva-ai/connector-snowflake build`
- [ ] `pnpm test:package-acceptance:snowflake`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/snowflake/src/constants.ts`
- [ ] Read-only role + fixed warehouse documented for operators
- [ ] No passwords or private keys in tarball
