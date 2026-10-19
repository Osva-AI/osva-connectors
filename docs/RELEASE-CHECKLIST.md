# Release checklist — `@osva-ai/connector-github`

Use this checklist for the **first public npm release** and subsequent semver releases.

## Engineering verification (repository)

- [ ] `main` is green on [CI](../../.github/workflows/ci.yml) for the release commit
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck` pass
- [ ] `pnpm test` passes (including mock GitHub provider / stdio fixture tests)
- [ ] `pnpm build` produces `packages/github/dist`
- [ ] `pnpm test:package-acceptance` passes (real tarball, isolated install, MCP smoke)
- [ ] `pnpm verify:boundaries` passes
- [ ] `packages/github/package.json` `version` matches `CONNECTOR_VERSION` in `src/constants.ts`
- [ ] `git status` clean at release commit (no uncommitted changes)
- [ ] `git diff --check` clean

## Package contents

- [ ] `pnpm pack` in `packages/github` includes `dist/`, `README.md`, `LICENSE` only (no tests, fixtures, or `.env`)
- [ ] `engines.node` is `>=24`
- [ ] `@osva-ai/connector-sdk` remains the tested RC pin (`1.1.0-rc.2` unless compatibility work says otherwise)

## npm registry (operator)

- [ ] `@osva-ai/connector-github` org/package exists and maintainers are correct
- [ ] **npm trusted publishing** (GitHub OIDC) configured for `Osva-AI/osva-connectors`, or a short-lived automation token stored in GitHub Environment **`npm`** (prefer OIDC)
- [ ] GitHub Environment **`npm`** exists with required reviewers (no publish from pull requests)
- [ ] Target version **not** already on npm: `npm view @osva-ai/connector-github@<version> version` → 404

## Publish (manual — after checklist)

- [ ] Draft release notes reviewed ([0.3.0 draft](./releases/0.3.0-RELEASE-NOTES.md))
- [ ] Run [Release to npm](../../.github/workflows/npm-release.yml) via **Actions → Run workflow**
  - Set **expected_version** to match `package.json`
  - Run with **dry_run** first (`npm publish --dry-run`)
  - Re-run with **dry_run** disabled only after operator approval and environment gate
- [ ] Post-publish: `npm view @osva-ai/connector-github@<version>` succeeds
- [ ] Post-publish: clean install smoke from [INSTALL.md](./INSTALL.md) (new machine or temp directory)

## Explicitly out of scope for automated publish

- No publish on push to `main`
- No publish on pull request CI
- No npm tokens in CI verify jobs
- No GitHub **Release** tag created automatically by the npm workflow (create tags/releases separately if desired)

## Pending until externally configured

- npm trusted publisher / `npm` environment approval (not verifiable in-repo)
- First successful `npm publish` (not executed during C3.3 implementation)
