# Release checklist — `@osva-ai/connector-tavily`

**B3 verified publication (2026-11-08):** `@osva-ai/connector-tavily@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**. Record: [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md). Workflow: [npm-release-tavily.yml](../.github/workflows/npm-release-tavily.yml).

- [ ] `pnpm --filter @osva-ai/connector-tavily format:check`
- [ ] `pnpm --filter @osva-ai/connector-tavily lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-tavily test`
- [ ] `pnpm --filter @osva-ai/connector-tavily build`
- [ ] `pnpm test:package-acceptance:tavily`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/tavily/src/constants.ts`
- [ ] `pnpm test:package-acceptance:registry-b3`
- [ ] `npm view @osva-ai/connector-tavily@0.1.0 version` → `0.1.0`
