# Release checklist — `@osva-ai/connector-gmail`

**B3 verified publication (2026-11-08):** `@osva-ai/connector-gmail@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**. Record: [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md).

Publishing is **independent** ([npm-release-gmail.yml](../.github/workflows/npm-release-gmail.yml)).

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

## Registry consumer acceptance (post-bootstrap)

- [ ] `node scripts/package-acceptance-registry-b3.mjs` (or `pnpm test:package-acceptance:registry-b3`) — public registry install, not `pnpm pack`
- [ ] `npm view @osva-ai/connector-gmail@0.1.0 version` → `0.1.0`

## GitHub Actions OIDC (next semver)

See [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md#github-actions-trusted-publishing-future-oidc-releases). Workflow: **Release Gmail to npm** with `dry_run=true` before any patch upload.
