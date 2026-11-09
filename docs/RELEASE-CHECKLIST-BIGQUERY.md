# Release checklist — `@osva-ai/connector-bigquery`

**B4.9 source-only** until npm bootstrap. Workflow: [npm-release-bigquery.yml](../.github/workflows/npm-release-bigquery.yml).

- [ ] `pnpm --filter @osva-ai/connector-bigquery format:check`
- [ ] `pnpm --filter @osva-ai/connector-bigquery lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-bigquery test`
- [ ] `pnpm --filter @osva-ai/connector-bigquery build`
- [ ] `pnpm test:package-acceptance:bigquery`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/bigquery/src/constants.ts`
- [ ] Dry-run + `maximumBytesBilled` behavior reviewed for data tools
- [ ] No service-account JSON or secrets in tarball
