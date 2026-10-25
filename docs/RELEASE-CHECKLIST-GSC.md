# Release checklist — `@osva-ai/connector-gsc`

Publishing uses [npm-release-gsc.yml](../.github/workflows/npm-release-gsc.yml) (`workflow_dispatch` only).

## Engineering verification

- [ ] `main` CI green for release commit
- [ ] `pnpm format:check`
- [ ] `pnpm --filter @osva-ai/connector-gsc lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-gsc test`
- [ ] `pnpm --filter @osva-ai/connector-gsc build`
- [ ] `pnpm test:package-acceptance:gsc`
- [ ] `pnpm verify:boundaries`
- [ ] `packages/gsc/package.json` version matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)
- [ ] Clean `git status` and `git diff --check`

## Package contents

- [ ] `pnpm pack` includes `dist/`, `README.md`, `LICENSE` (no `test/` or secrets)
- [ ] `bin.osva-connector-gsc` → `dist/stdio.js`
- [ ] `@osva-ai/connector-sdk@1.1.0-rc.2` pin verified

## npm (operator)

- [ ] `@osva-ai` org publish access
- [ ] `npm view @osva-ai/connector-gsc@0.1.0 version` → 404 before first publish
- [ ] npm **Trusted Publisher** (OIDC) configured after bootstrap upload
- [ ] Release workflow: `dry_run=true` first; real publish requires `dry_run=false` and `confirm_publish=true`

See [docs/releases/0.1.0-RELEASE-NOTES-gsc.md](./releases/0.1.0-RELEASE-NOTES-gsc.md).
