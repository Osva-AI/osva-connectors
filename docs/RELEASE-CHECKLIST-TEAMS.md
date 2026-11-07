# Release checklist — `@osva-ai/connector-teams`

**Pre-publication (source-only @0.1.0):** Workflow: [npm-release-teams.yml](../.github/workflows/npm-release-teams.yml).

- [ ] `pnpm --filter @osva-ai/connector-teams format:check`
- [ ] `pnpm --filter @osva-ai/connector-teams lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-teams test`
- [ ] `pnpm --filter @osva-ai/connector-teams build`
- [ ] `pnpm test:package-acceptance:teams`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/teams/src/constants.ts`
- [ ] After bootstrap: `npm view @osva-ai/connector-teams@0.1.0 version` → `0.1.0`
