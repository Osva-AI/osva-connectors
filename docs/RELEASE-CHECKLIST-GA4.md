# Release checklist — `@osva-ai/connector-ga4`

Use this checklist for the **first public npm release (`0.1.0`)** and subsequent semver releases.

Publishing is **independent** from other connectors (workflow: [npm-release-ga4.yml](../.github/workflows/npm-release-ga4.yml)).

## Engineering verification (repository)

- [ ] `main` is green on [CI](../.github/workflows/ci.yml) for the release commit
- [ ] `pnpm format:check` passes
- [ ] `pnpm --filter @osva-ai/connector-ga4 lint` and `typecheck` pass
- [ ] `pnpm --filter @osva-ai/connector-ga4 test` passes
- [ ] `pnpm --filter @osva-ai/connector-ga4 build` produces `packages/ga4/dist`
- [ ] `pnpm test:package-acceptance:ga4` passes (tarball install + MCP smoke outside repo)
- [ ] `pnpm verify:boundaries` passes
- [ ] `packages/ga4/package.json` `version` matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)
- [ ] `git status` clean at release commit
- [ ] `git diff --check` clean

## Package contents

- [ ] `pnpm pack` in `packages/ga4` includes `dist/`, `README.md`, `LICENSE` (no `test/`, fixtures, or `.env`)
- [ ] `engines.node` is `>=24`
- [ ] `bin.osva-connector-ga4` is `dist/stdio.js` (no `./` prefix — npm must not strip the bin)
- [ ] `@osva-ai/connector-sdk` pin is the tested RC (`1.1.0-rc.2` unless compatibility work says otherwise)
- [ ] Runtime deps are public npm packages (`@osva-ai/connector-sdk`, `google-auth-library`, `zod`); no unpublished private packages

## npm registry (operator)

- [ ] **`@osva-ai` npm organization** — permission to publish **public** scoped packages
- [ ] Target version **not** already on npm (first release): `npm view @osva-ai/connector-ga4@0.1.0 version` → 404

### First publication procedure (required once)

npm **trusted publishing (OIDC) cannot create a brand-new package** — the package must exist on the registry before **Trusted Publisher** settings are available ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [npm/documentation#1926](https://github.com/npm/documentation/issues/1926)).

1. Confirm **hosted CI** and **Release GA4 to npm** workflow with `dry_run=true` are green on `main`.
2. Confirm **`@osva-ai` org** publishing access and **2FA** as required by npm.
3. Confirm version **`0.1.0` is not published or staged:** `npm view @osva-ai/connector-ga4@0.1.0 version` → 404.
4. From a maintainer machine with **npm login**:
   - Repo root: `pnpm install --frozen-lockfile && pnpm --filter @osva-ai/connector-ga4 build`
   - `pnpm test:package-acceptance:ga4`
   - `cd packages/ga4`
   - Pre-flight (no upload):

     ```bash
     npm publish --dry-run --access public --provenance=false
     ```

     Must **not** warn that `bin[osva-connector-ga4]` was “invalid and removed”.

   - **First upload only** — disable provenance locally (no GitHub OIDC on a laptop):

     ```bash
     npm publish --access public --provenance=false
     ```

     Do **not** run this command until operator sign-off; it is documented here, not executed in G3 automation.

5. Complete npm **package validation** or **staged-release approval** if the registry prompts for a new scoped package.
6. **Verify on npm:** `npm view @osva-ai/connector-ga4@0.1.0 version` and `npm view @osva-ai/connector-ga4 bin`.
7. **Clean install smoke:** temporary directory, `npm install @osva-ai/connector-ga4@0.1.0`, configure credentials, confirm **seven** MCP tools via `tools/list` (see [INSTALL-GA4.md](./INSTALL-GA4.md)).
8. **Trusted Publisher** on [npmjs.com](https://www.npmjs.com/) → **`@osva-ai/connector-ga4`** → **Settings** → **Trusted Publisher** → **GitHub Actions**:
   - **Organization or user:** `Osva-AI`
   - **Repository:** `osva-connectors`
   - **Workflow filename:** `npm-release-ga4.yml` (filename only)
   - **Environment name:** `npm`
9. Complete a **successful OIDC publish within 2 days** of creating the trusted publisher config, or npm may expire the config.

### Post-bootstrap registry verification

- [ ] `npm view @osva-ai/connector-ga4@0.1.0 version` → `0.1.0`
- [ ] `npm view @osva-ai/connector-ga4 bin` → `osva-connector-ga4` → `dist/stdio.js`
- [ ] GitHub Environment **`npm`** exists with required reviewers ([workflow](../.github/workflows/npm-release-ga4.yml) is `workflow_dispatch` only)

## Publish via GitHub Actions (after bootstrap)

- [ ] Review [0.1.0 release notes](./releases/0.1.0-RELEASE-NOTES-ga4.md)
- [ ] **Actions → Release GA4 to npm** ([npm-release-ga4.yml](../.github/workflows/npm-release-ga4.yml))
  - `expected_version`: `0.1.0`
  - First run: `dry_run=true` (repeatable even after `0.1.0` exists on npm)
  - Upload: `dry_run=false`, `confirm_publish=true`, after environment approval
- [ ] Post-publish: `npm view @osva-ai/connector-ga4@0.1.0`
- [ ] Post-publish: clean install smoke from [INSTALL-GA4.md](./INSTALL-GA4.md)

**Note:** You cannot republish an existing version to “test” OIDC. Use `dry_run=true` on the workflow, or publish a new patch version after bootstrap.

## Explicitly out of scope for automated publish

- No publish on push to `main` or on pull request CI
- No npm tokens in CI verify jobs (only release workflow + environment `npm`)
- No automatic GitHub Release tags
- Does not publish other `@osva-ai/connector-*` packages

## Pending until externally configured

- npm trusted publisher for `@osva-ai/connector-ga4`
- First successful manual `npm publish` bootstrap
- GitHub Environment `npm` approval gate
