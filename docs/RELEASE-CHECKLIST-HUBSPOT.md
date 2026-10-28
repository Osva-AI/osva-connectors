# Release checklist — `@osva-ai/connector-hubspot`

- [ ] `pnpm --filter @osva-ai/connector-hubspot lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-hubspot test`
- [ ] `pnpm --filter @osva-ai/connector-hubspot build`
- [ ] `pnpm test:package-acceptance:hubspot`
- [ ] `CONNECTOR_VERSION` in `packages/hubspot/src/constants.ts` matches `package.json`
- [ ] `bin.osva-connector-hubspot` → `dist/stdio.js`
- [ ] `npm view @osva-ai/connector-hubspot@0.1.0 version` → 404 before first publish
