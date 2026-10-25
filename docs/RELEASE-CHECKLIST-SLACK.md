# Release checklist — `@osva-ai/connector-slack`

Use this checklist for the **first public npm release (`0.1.0`)** and subsequent semver releases.

Publishing is **independent** from other connectors (workflow: [npm-release-slack.yml](../.github/workflows/npm-release-slack.yml)).

## Engineering verification (repository)

- [ ] `main` is green on [CI](../.github/workflows/ci.yml) for the release commit
- [ ] `pnpm format:check` passes
- [ ] `pnpm --filter @osva-ai/connector-slack lint` and `typecheck` pass
- [ ] `pnpm --filter @osva-ai/connector-slack test` passes
- [ ] `pnpm --filter @osva-ai/connector-slack build` produces `packages/slack/dist`
- [ ] `pnpm test:package-acceptance:slack` passes (tarball install + MCP smoke outside repo)
- [ ] `pnpm verify:boundaries` passes
- [ ] `packages/slack/package.json` `version` matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)
- [ ] `git status` clean at release commit
- [ ] `git diff --check` clean

## Package contents

- [ ] `pnpm pack` in `packages/slack` includes `dist/`, `README.md`, `LICENSE` (no `test/`, fixtures, or `.env`)
- [ ] `engines.node` is `>=24`
- [ ] `bin.osva-connector-slack` is `dist/stdio.js` (no `./` prefix)
- [ ] `@osva-ai/connector-sdk` pin is `1.1.0-rc.2` unless compatibility work says otherwise
- [ ] Runtime deps are public npm packages only

## npm registry (operator)

- [ ] **`@osva-ai` npm organization** — permission to publish **public** scoped packages
- [ ] Target version **not** already on npm: `npm view @osva-ai/connector-slack@0.1.0 version` → 404

### First publication procedure (required once)

npm **trusted publishing (OIDC) cannot create a brand-new package** — the package must exist on the registry before **Trusted Publisher** settings are available.

1. Confirm **hosted CI** and **Release Slack to npm** workflow with `dry_run=true` are green on `main`.
2. Confirm **`@osva-ai` org** publishing access and **2FA** as required by npm.
3. Confirm version **`0.1.0` is not published or staged:** `npm view @osva-ai/connector-slack@0.1.0 version` → 404.
4. From a maintainer machine with **npm login**:
   - Repo root: `pnpm install --frozen-lockfile && pnpm --filter @osva-ai/connector-slack build`
   - `pnpm test:package-acceptance:slack`
   - `cd packages/slack`
   - Pre-flight: `npm publish --dry-run --access public --provenance=false`
   - **First upload only:** `npm publish --access public --provenance=false` (operator sign-off required)
5. Complete npm **package validation** or **staged-release approval** if prompted for a new scoped package.
6. **Verify on npm:** `npm view @osva-ai/connector-slack@0.1.0 version` and `npm view @osva-ai/connector-slack bin`.
7. **Clean install smoke:** temporary directory, `npm install @osva-ai/connector-slack@0.1.0`, configure bot token, confirm **seven** MCP tools via `tools/list` (see [INSTALL-SLACK.md](./INSTALL-SLACK.md)).
8. **Trusted Publisher** on npm → **`@osva-ai/connector-slack`** → **Settings** → **Trusted Publisher** → **GitHub Actions**:
   - **Organization or user:** `Osva-AI`
   - **Repository:** `osva-connectors`
   - **Workflow filename:** `npm-release-slack.yml`
   - **Environment name:** `npm`
9. Complete a **successful OIDC publish within 2 days** of creating the trusted publisher config.

### Post-bootstrap registry verification

- [ ] `npm view @osva-ai/connector-slack@0.1.0 version` → `0.1.0`
- [ ] `npm view @osva-ai/connector-slack bin` → `osva-connector-slack` → `dist/stdio.js`
- [ ] GitHub Environment **`npm`** exists with required reviewers

## Publish via GitHub Actions (after bootstrap)

- [ ] Review [0.1.0 release notes](./releases/0.1.0-RELEASE-NOTES-slack.md)
- [ ] **Actions → Release Slack to npm** ([npm-release-slack.yml](../.github/workflows/npm-release-slack.yml))
  - `expected_version`: `0.1.0`
  - `dry_run`: `true` first; then `dry_run`: `false`, `confirm_publish`: `true` after approval
- [ ] No automatic git tag or GitHub Release is created by this workflow
