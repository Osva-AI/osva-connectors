# Release checklist — `@osva-ai/connector-google-drive`

Publishing uses [npm-release-google-drive.yml](../.github/workflows/npm-release-google-drive.yml) (`workflow_dispatch` only).

## Engineering verification

- [ ] `main` CI green for release commit
- [ ] `pnpm format:check`
- [ ] `pnpm --filter @osva-ai/connector-google-drive lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-google-drive test`
- [ ] `pnpm --filter @osva-ai/connector-google-drive build`
- [ ] `pnpm test:package-acceptance:google-drive`
- [ ] `pnpm verify:boundaries`
- [ ] `packages/google-drive/package.json` version matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)
- [ ] Clean `git status` and `git diff --check`

## Package contents

- [ ] `pnpm pack` includes `dist/`, `README.md`, `LICENSE` (no `test/` or secrets)
- [ ] `bin.osva-connector-google-drive` → `dist/stdio.js`
- [ ] `@osva-ai/connector-sdk@1.1.0-rc.2` pin verified

## npm (operator)

- [ ] `@osva-ai` org publish access
- [ ] `npm view @osva-ai/connector-google-drive@0.1.0 version` → 404 before first publish
- [ ] **Bootstrap (one-time):** from a maintainer machine, `npm publish --access public --provenance=false` if Trusted Publisher is not yet configured; npm may require staged validation for restricted scopes
- [ ] Configure npm **Trusted Publisher** (OIDC) for GitHub Actions after bootstrap
- [ ] Release workflow: `dry_run=true` first; real publish requires `dry_run=false` and `confirm_publish=true`

See [docs/releases/0.1.0-RELEASE-NOTES-google-drive.md](./releases/0.1.0-RELEASE-NOTES-google-drive.md).
