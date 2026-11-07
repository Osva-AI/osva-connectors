# Release checklist — `@osva-ai/connector-firecrawl`

**B3 verified publication (2026-11-08):** `@osva-ai/connector-firecrawl@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**. Record: [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md). Workflow: [npm-release-firecrawl.yml](../.github/workflows/npm-release-firecrawl.yml).

- [ ] `pnpm --filter @osva-ai/connector-firecrawl format:check`
- [ ] `pnpm --filter @osva-ai/connector-firecrawl lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-firecrawl test`
- [ ] `pnpm --filter @osva-ai/connector-firecrawl build`
- [ ] `pnpm test:package-acceptance:firecrawl`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/firecrawl/src/constants.ts`
- [ ] `pnpm test:package-acceptance:registry-b3`
- [ ] `npm view @osva-ai/connector-firecrawl@0.1.0 version` → `0.1.0`
