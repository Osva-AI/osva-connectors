# Release checklist — `@osva-ai/connector-mixpanel`

Publishing uses [npm-release-mixpanel.yml](../.github/workflows/npm-release-mixpanel.yml) (`workflow_dispatch` only).

## Engineering verification

- [ ] `main` CI green for release commit
- [ ] `pnpm format:check`
- [ ] `pnpm --filter @osva-ai/connector-mixpanel lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-mixpanel test`
- [ ] `pnpm --filter @osva-ai/connector-mixpanel build`
- [ ] `pnpm test:package-acceptance:mixpanel`
- [ ] `pnpm verify:boundaries`
- [ ] `packages/mixpanel/package.json` version matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)
- [ ] Clean `git status` and `git diff --check`

## Package contents

- [ ] `pnpm pack` includes `dist/`, `README.md`, `LICENSE` (no `test/` or secrets)
- [ ] `bin.osva-connector-mixpanel` → `dist/stdio.js`
- [ ] `@osva-ai/connector-sdk@1.1.4` pin verified

## npm (operator)

- [ ] `@osva-ai` org publish access
- [ ] `npm view @osva-ai/connector-mixpanel@0.1.0 version` → 404 before first publish
- [ ] npm **Trusted Publisher** (OIDC) configured after bootstrap upload
- [ ] Release workflow: `dry_run=true` first; real publish requires `dry_run=false` and `confirm_publish=true`
