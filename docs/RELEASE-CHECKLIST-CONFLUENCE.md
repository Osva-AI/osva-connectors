# Release checklist — `@osva-ai/connector-confluence`

**Pre-publication (source-only @0.1.0):** Workflow: [npm-release-confluence.yml](../.github/workflows/npm-release-confluence.yml).

- [ ] `pnpm --filter @osva-ai/connector-confluence format:check`
- [ ] `pnpm --filter @osva-ai/connector-confluence lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-confluence test`
- [ ] `pnpm --filter @osva-ai/connector-confluence build`
- [ ] `pnpm test:package-acceptance:confluence`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/confluence/src/constants.ts`
- [ ] After bootstrap: `npm view @osva-ai/connector-confluence@0.1.0 version` → `0.1.0`
