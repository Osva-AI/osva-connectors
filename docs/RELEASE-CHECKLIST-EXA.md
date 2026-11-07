# Release checklist — `@osva-ai/connector-exa`

- [ ] `pnpm --filter @osva-ai/connector-exa format:check`
- [ ] `pnpm --filter @osva-ai/connector-exa lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-exa test`
- [ ] `pnpm --filter @osva-ai/connector-exa build`
- [ ] `pnpm test:package-acceptance:exa`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/exa/src/constants.ts`
