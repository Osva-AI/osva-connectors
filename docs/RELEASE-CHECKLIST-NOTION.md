# Release checklist — `@osva-ai/connector-notion`

- [ ] `pnpm --filter @osva-ai/connector-notion format:check`
- [ ] `pnpm --filter @osva-ai/connector-notion lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-notion test`
- [ ] `pnpm --filter @osva-ai/connector-notion build`
- [ ] `pnpm test:package-acceptance:notion`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/notion/src/constants.ts`
