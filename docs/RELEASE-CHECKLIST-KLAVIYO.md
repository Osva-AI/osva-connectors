# Release checklist — `@osva-ai/connector-klaviyo`

- [ ] `pnpm --filter @osva-ai/connector-klaviyo lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-klaviyo test`
- [ ] `pnpm --filter @osva-ai/connector-klaviyo build`
- [ ] `pnpm test:package-acceptance:klaviyo`
- [ ] `CONNECTOR_VERSION` in `packages/klaviyo/src/constants.ts` matches `package.json`
- [ ] `bin.osva-connector-klaviyo` → `dist/stdio.js`
- [ ] `npm view @osva-ai/connector-klaviyo@0.1.0 version` → 404 before first publish
