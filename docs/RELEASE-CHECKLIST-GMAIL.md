# Release checklist — `@osva-ai/connector-gmail`

## Engineering verification

- [ ] `pnpm --filter @osva-ai/connector-gmail format:check`
- [ ] `pnpm --filter @osva-ai/connector-gmail lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-gmail test`
- [ ] `pnpm --filter @osva-ai/connector-gmail build`
- [ ] `pnpm test:package-acceptance:gmail`
- [ ] `pnpm verify:boundaries`
- [ ] `packages/gmail/package.json` version matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)

## Package contents

- [ ] `pnpm pack` includes `dist/`, `README.md`, `LICENSE` (no `test/` or secrets)
- [ ] `bin.osva-connector-gmail` → `dist/stdio.js`
- [ ] `@osva-ai/connector-sdk@1.1.4` pin verified
