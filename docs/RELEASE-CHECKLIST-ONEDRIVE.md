# Release checklist — `@osva-ai/connector-onedrive`

**Pre-publication (source-only @0.1.0):** Workflow: [npm-release-onedrive.yml](../.github/workflows/npm-release-onedrive.yml).

- [ ] `pnpm --filter @osva-ai/connector-onedrive format:check`
- [ ] `pnpm --filter @osva-ai/connector-onedrive lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-onedrive test`
- [ ] `pnpm --filter @osva-ai/connector-onedrive build`
- [ ] `pnpm test:package-acceptance:onedrive`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/onedrive/src/constants.ts`
- [ ] After bootstrap: `npm view @osva-ai/connector-onedrive@0.1.0 version` → `0.1.0`
