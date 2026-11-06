# Release checklist — `@osva-ai/connector-google-calendar`

## Engineering verification

- [ ] `pnpm --filter @osva-ai/connector-google-calendar format:check`
- [ ] `pnpm --filter @osva-ai/connector-google-calendar lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-google-calendar test`
- [ ] `pnpm --filter @osva-ai/connector-google-calendar build`
- [ ] `pnpm test:package-acceptance:google-calendar`
- [ ] `pnpm verify:boundaries`
- [ ] `packages/google-calendar/package.json` version matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)

## Package contents

- [ ] `pnpm pack` includes `dist/`, `README.md`, `LICENSE` (no `test/` or secrets)
- [ ] `bin.osva-connector-google-calendar` → `dist/stdio.js`
- [ ] `@osva-ai/connector-sdk@1.1.4` pin verified
