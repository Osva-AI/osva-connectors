# Release checklist — `@osva-ai/connector-linear`

- [ ] `pnpm --filter @osva-ai/connector-linear format:check`
- [ ] `pnpm --filter @osva-ai/connector-linear lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-linear test`
- [ ] `pnpm --filter @osva-ai/connector-linear build`
- [ ] `pnpm test:package-acceptance:linear`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/linear/src/constants.ts`
