# Release checklist — `@osva-ai/connector-shopify`

Use this checklist for the **first public npm release (`0.1.0`)** and subsequent semver releases.

Publishing is **independent** from [`@osva-ai/connector-github`](./RELEASE-CHECKLIST.md) and [`@osva-ai/connector-postgres`](./RELEASE-CHECKLIST-POSTGRES.md) (workflow: [npm-release-shopify.yml](../.github/workflows/npm-release-shopify.yml)).

## Engineering verification (repository)

- [ ] `main` is green on [CI](../.github/workflows/ci.yml) for the release commit
- [ ] `pnpm format:check` passes
- [ ] `pnpm --filter @osva-ai/connector-shopify lint` and `typecheck` pass
- [ ] `pnpm --filter @osva-ai/connector-shopify test` passes
- [ ] `pnpm --filter @osva-ai/connector-shopify build` produces `packages/shopify/dist`
- [ ] `pnpm test:package-acceptance:shopify` passes (tarball install + MCP smoke outside repo)
- [ ] `pnpm verify:boundaries` passes
- [ ] `packages/shopify/package.json` `version` matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)
- [ ] `git status` clean at release commit
- [ ] `git diff --check` clean

## Package contents

- [ ] `pnpm pack` in `packages/shopify` includes `dist/`, `README.md`, `LICENSE` (no `test/`, fixtures, or `.env`)
- [ ] `engines.node` is `>=24`
- [ ] `bin.osva-connector-shopify` is `dist/stdio.js` (no `./` prefix — npm must not strip the bin)
- [ ] `@osva-ai/connector-sdk` pin is the tested RC (`1.1.0-rc.2` unless compatibility work says otherwise)
- [ ] Only public npm dependencies (`@osva-ai/connector-sdk`, `zod`); no unpublished private packages

## npm registry (operator)

- [ ] **`@osva-ai` npm organization** — permission to publish **public** scoped packages
- [ ] Target version **not** already on npm (first release): `npm view @osva-ai/connector-shopify@0.1.0 version` → 404

### First publication bootstrap (required once)

npm **trusted publishing (OIDC) cannot create a brand-new package** — the package must exist on the registry before **Trusted Publisher** settings are available ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [npm/documentation#1926](https://github.com/npm/documentation/issues/1926)).

1. Confirm **`@osva-ai` org** publishing access and **2FA** as required by npm.
2. Verify **`0.1.0` is not published or staged:** `npm view @osva-ai/connector-shopify@0.1.0 version` → 404.
3. Verify **green hosted CI** and **clean `main`** at the release commit.
4. From a maintainer machine with **npm login**:
   - Repo root: `pnpm install --frozen-lockfile && pnpm --filter @osva-ai/connector-shopify build`
   - `pnpm test:package-acceptance:shopify`
   - `cd packages/shopify`
   - Pre-flight (no upload):

     ```bash
     npm publish --dry-run --access public --provenance=false
     ```

     Must **not** warn that `bin[osva-connector-shopify]` was “invalid and removed”.

5. **First upload only** — disable provenance locally (no GitHub OIDC on a laptop):

   ```bash
   npm publish --access public --provenance=false
   ```

   Do **not** run this command until operator sign-off; it is documented here, not executed in automation.

6. If npm **stages** the package for review, follow npm’s approval process before treating the release as live.
7. **Post-bootstrap registry verification:**
   - `npm view @osva-ai/connector-shopify@0.1.0 version` → `0.1.0`
   - `npm view @osva-ai/connector-shopify bin` → `osva-connector-shopify` → `dist/stdio.js`
8. **Fresh install smoke:** temporary directory → `npm install @osva-ai/connector-shopify@0.1.0` → MCP host or manual `tools/list` → exactly **seven** tools (see [INSTALL-SHOPIFY.md](./INSTALL-SHOPIFY.md)).
9. **Trusted Publisher** on [npmjs.com](https://www.npmjs.com/) → **`@osva-ai/connector-shopify`** → **Settings** → **Trusted Publisher** → **GitHub Actions**:
   - **Organization or user:** `Osva-AI`
   - **Repository:** `osva-connectors`
   - **Workflow filename:** `npm-release-shopify.yml` (filename only)
   - **Environment name:** `npm`
   - **Allow npm publish:** enabled
10. Complete a **successful OIDC publish within 2 days** of creating the trusted publisher config, or npm may expire the config.

**Do not change** trusted publisher settings for `@osva-ai/connector-github` (`npm-release.yml`) or `@osva-ai/connector-postgres` (`npm-release-postgres.yml`).

### Post-bootstrap GitHub Actions publish

- [ ] Review [0.1.0 release notes](./releases/0.1.0-RELEASE-NOTES-shopify.md)
- [ ] **Actions → Release Shopify to npm** ([npm-release-shopify.yml](../.github/workflows/npm-release-shopify.yml))
  - `expected_version`: `0.1.0`
  - Validation: `dry_run=true` (repeatable even after `0.1.0` exists on npm)
  - Upload: `dry_run=false`, `confirm_publish=true`, after **GitHub Environment `npm`** approval
- [ ] Post-publish: `npm view @osva-ai/connector-shopify@0.1.0`
- [ ] Post-publish: clean install checks from [INSTALL-SHOPIFY.md](./INSTALL-SHOPIFY.md)

**Note:** You cannot republish an existing version to “test” OIDC. Use `dry_run=true` on the workflow, or publish a new patch version after bootstrap.

## Explicitly out of scope for automated publish

- No publish on push to `main` or on pull request CI
- No npm tokens in CI verify jobs (only release workflow + environment `npm`)
- No automatic GitHub Release tags
- Does not publish `@osva-ai/connector-github` or `@osva-ai/connector-postgres`

## Pending until externally configured

- npm trusted publisher for `@osva-ai/connector-shopify`
- First successful manual `npm publish` bootstrap
- GitHub Environment `npm` approval gate
