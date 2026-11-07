# Release checklist — `@osva-ai/connector-firecrawl`

- [ ] `pnpm --filter @osva-ai/connector-firecrawl format:check`
- [ ] `pnpm --filter @osva-ai/connector-firecrawl lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-firecrawl test`
- [ ] `pnpm --filter @osva-ai/connector-firecrawl build`
- [ ] `pnpm test:package-acceptance:firecrawl`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/firecrawl/src/constants.ts`
