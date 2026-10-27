# Release checklist — `@osva-ai/connector-whatsapp`

- [ ] `pnpm --filter @osva-ai/connector-whatsapp lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-whatsapp test`
- [ ] `pnpm --filter @osva-ai/connector-whatsapp build`
- [ ] `pnpm test:package-acceptance:whatsapp`
- [ ] `CONNECTOR_VERSION` in `packages/whatsapp/src/constants.ts` matches `package.json`
- [ ] `bin.osva-connector-whatsapp` → `dist/stdio.js`
- [ ] `npm view @osva-ai/connector-whatsapp@0.1.0 version` → 404 before first publish
