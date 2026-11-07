# Release checklist — `@osva-ai/connector-tavily`

- [ ] `pnpm --filter @osva-ai/connector-tavily format:check`
- [ ] `pnpm --filter @osva-ai/connector-tavily lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-tavily test`
- [ ] `pnpm --filter @osva-ai/connector-tavily build`
- [ ] `pnpm test:package-acceptance:tavily`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/tavily/src/constants.ts`
