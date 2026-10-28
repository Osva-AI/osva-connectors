# Release checklist — `@osva-ai/connector-stripe`

- [ ] `pnpm --filter @osva-ai/connector-stripe lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-stripe test`
- [ ] `pnpm --filter @osva-ai/connector-stripe build`
- [ ] `pnpm test:package-acceptance:stripe`
- [ ] `CONNECTOR_VERSION` in `packages/stripe/src/constants.ts` matches `package.json`
- [ ] `STRIPE_API_VERSION` documented in README matches `constants.ts`
- [ ] `bin.osva-connector-stripe` → `dist/stdio.js`
- [ ] `npm view @osva-ai/connector-stripe@0.1.0 version` → 404 before first publish
