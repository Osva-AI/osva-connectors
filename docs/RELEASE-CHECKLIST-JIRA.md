# Release checklist — `@osva-ai/connector-jira`

**Pre-publication (source-only @0.1.0):** Workflow: [npm-release-jira.yml](../.github/workflows/npm-release-jira.yml).

- [ ] `pnpm --filter @osva-ai/connector-jira format:check`
- [ ] `pnpm --filter @osva-ai/connector-jira lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-jira test`
- [ ] `pnpm --filter @osva-ai/connector-jira build`
- [ ] `pnpm test:package-acceptance:jira`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/jira/src/constants.ts`
- [ ] After bootstrap: `npm view @osva-ai/connector-jira@0.1.0 version` → `0.1.0`
