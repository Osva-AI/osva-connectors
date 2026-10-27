# Release checklist — `@osva-ai/connector-meta-ads`

Publishing uses [npm-release-meta-ads.yml](../.github/workflows/npm-release-meta-ads.yml) (`workflow_dispatch` only).

## Engineering verification

- [ ] `main` CI green for release commit
- [ ] `pnpm format:check`
- [ ] `pnpm --filter @osva-ai/connector-meta-ads lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-meta-ads test`
- [ ] `pnpm --filter @osva-ai/connector-meta-ads build`
- [ ] `pnpm test:package-acceptance:meta-ads`
- [ ] `pnpm verify:boundaries`
- [ ] `packages/meta-ads/package.json` version matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)
- [ ] Clean `git status` and `git diff --check`

## Package contents

- [ ] `pnpm pack` includes `dist/`, `README.md`, `LICENSE` (no `test/` or secrets)
- [ ] `bin.osva-connector-meta-ads` → `dist/stdio.js`
- [ ] `@osva-ai/connector-sdk@1.1.0-rc.2` pin verified

## npm (operator)

- [ ] `@osva-ai` org publish access
- [ ] `npm view @osva-ai/connector-meta-ads@0.1.0 version` → 404 before first publish
- [ ] **Bootstrap (one-time):** maintainer `npm publish --access public --provenance=false` if Trusted Publisher is not yet configured
- [ ] Configure npm **Trusted Publisher** (OIDC) for GitHub Actions after bootstrap
- [ ] Release workflow: `dry_run=true` first; real publish requires `dry_run=false` and `confirm_publish=true`

See [docs/releases/0.1.0-RELEASE-NOTES-meta-ads.md](./releases/0.1.0-RELEASE-NOTES-meta-ads.md).
