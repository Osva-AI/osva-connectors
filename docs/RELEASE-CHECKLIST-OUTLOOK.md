# Release checklist — `@osva-ai/connector-outlook`

**Pre-publication (source-only @0.1.0):** Workflow: [npm-release-outlook.yml](../.github/workflows/npm-release-outlook.yml).

- [ ] `pnpm --filter @osva-ai/connector-outlook format:check`
- [ ] `pnpm --filter @osva-ai/connector-outlook lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-outlook test`
- [ ] `pnpm --filter @osva-ai/connector-outlook build`
- [ ] `pnpm test:package-acceptance:outlook`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/outlook/src/constants.ts`
- [ ] After bootstrap: `npm view @osva-ai/connector-outlook@0.1.0 version` → `0.1.0`
