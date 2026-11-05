# Release checklist — `@osva-ai/connector-stripe`

**M19 verified publication (2026-11-06):** `@osva-ai/connector-stripe@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**; GitHub OIDC trusted publisher environment **`npm`**. Record: [M19_PUBLICATION_RECORD.md](./M19_PUBLICATION_RECORD.md).

- [ ] `pnpm --filter @osva-ai/connector-stripe lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-stripe test`
- [ ] `pnpm --filter @osva-ai/connector-stripe build`
- [ ] `pnpm test:package-acceptance:stripe`
- [ ] `CONNECTOR_VERSION` in `packages/stripe/src/constants.ts` matches `package.json`
- [ ] `STRIPE_API_VERSION` documented in README matches `constants.ts`
- [ ] `bin.osva-connector-stripe` → `dist/stdio.js`
- [ ] `npm view @osva-ai/connector-stripe@0.1.0 version` → 404 before first publish
