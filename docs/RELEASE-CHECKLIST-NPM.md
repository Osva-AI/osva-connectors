# Release checklist — `@osva-ai/connector-npm`

Use this checklist for the **first public npm release (`0.1.0`)** and subsequent semver releases.

Publishing is **independent** from other connectors (workflow: [npm-release-npm.yml](../.github/workflows/npm-release-npm.yml)).

## Engineering verification (repository)

- [ ] `main` is green on [CI](../.github/workflows/ci.yml) for the release commit
- [ ] `pnpm format:check` passes
- [ ] `pnpm --filter @osva-ai/connector-npm lint` and `typecheck` pass
- [ ] `pnpm --filter @osva-ai/connector-npm test` passes
- [ ] `pnpm --filter @osva-ai/connector-npm build` produces `packages/npm/dist`
- [ ] `pnpm test:package-acceptance:npm` passes (tarball install + MCP smoke outside repo)
- [ ] `pnpm verify:boundaries` passes
- [ ] `packages/npm/package.json` `version` matches `CONNECTOR_VERSION` in `src/constants.ts` (`0.1.0`)
- [ ] `@osva-ai/connector-sdk` runtime pin is **`1.1.3`** (verified by package acceptance smoke)
- [ ] `git status` clean at release commit
- [ ] `git diff --check` clean

## Package contents

- [ ] `pnpm pack` in `packages/npm` includes `dist/`, `README.md`, `LICENSE` (no `test/`, fixtures, or `.env`)
- [ ] `engines.node` is `>=24`
- [ ] `bin.osva-connector-npm` is `dist/stdio.js` (no `./` prefix — npm must not strip the bin)
- [ ] Runtime deps are public npm packages only (`@osva-ai/connector-sdk@1.1.3`); no workspace or private packages

## npm registry (operator)

- [ ] **`@osva-ai` npm organization** — permission to publish **public** scoped packages
- [ ] Target version **not** already on npm (first release): `npm view @osva-ai/connector-npm@0.1.0 version` → 404

### npm authentication (two paths — do not mix bootstrap with OIDC upload)

| Phase                           | Where             | Authentication                                                                   | Provenance                |
| ------------------------------- | ----------------- | -------------------------------------------------------------------------------- | ------------------------- |
| **First public `0.1.0` (once)** | Maintainer laptop | `npm login` / `npm whoami`                                                       | `--provenance=false`      |
| **Subsequent semver uploads**   | GitHub Actions    | **Trusted Publisher OIDC** (recommended) or `NPM_TOKEN` on Environment **`npm`** | `--provenance` (workflow) |

**Manual bootstrap (laptop only)**

- [ ] Maintainer account is a member of **`@osva-ai`** with permission to publish scoped public packages
- [ ] Org **2FA** and npm session requirements are satisfied (`npm whoami` succeeds)
- [ ] `npm login` (or `npm login --auth-type=web` if required) — **not** used for routine releases after OIDC is configured

**GitHub Actions OIDC (after package exists on npm)**

- [ ] GitHub Environment **`npm`** exists with required reviewers — must match `environment: npm` in [npm-release-npm.yml](../.github/workflows/npm-release-npm.yml)
- [ ] npm **Trusted Publisher** on **`@osva-ai/connector-npm`**: Organization **`Osva-AI`**, repository **`osva-connectors`**, workflow filename **`npm-release-npm.yml`**, environment name **`npm`**
- [ ] Workflow has `permissions.id-token: write` (already set in repo) and npm CLI **11.5.1+** on the runner (workflow step)
- [ ] Optional fallback only: `NPM_TOKEN` stored as a secret on Environment **`npm`** (same name as Trusted Publisher environment)

### First publication bootstrap (required once)

npm **trusted publishing (OIDC) cannot create a brand-new package** — the package must exist on the registry before **Trusted Publisher** settings are available ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [npm/documentation#1926](https://github.com/npm/documentation/issues/1926)).

1. Confirm [CI](../.github/workflows/ci.yml) is green on `main` (optional pre-bootstrap: run **Release npm registry connector to npm** with `dry_run=true` to mirror release gates).
2. Confirm version **`0.1.0` is not published:** `npm view @osva-ai/connector-npm@0.1.0 version` → 404.
3. From a maintainer machine with **npm login** (PowerShell examples):

   ```powershell
   cd C:\path\to\osva-connectors
   git checkout main
   git pull origin main
   pnpm install --frozen-lockfile
   pnpm --filter @osva-ai/connector-npm build
   pnpm test:package-acceptance:npm
   cd packages\npm
   npm publish --dry-run --access public --provenance=false
   ```

   Must **not** warn that `bin[osva-connector-npm]` was “invalid and removed”.

4. **First upload only** — disable provenance locally (no GitHub OIDC on a laptop):

   ```powershell
   npm publish --access public --provenance=false --tag stable-candidate
   ```

   Omit `--tag stable-candidate` if your org publishes first versions directly to `latest`. Do **not** run upload until operator sign-off.

5. Complete npm **package validation** or **staged-release approval** if the registry prompts for a new scoped package.
6. **Verify on npm:**

   ```powershell
   npm view @osva-ai/connector-npm@0.1.0 version
   npm view @osva-ai/connector-npm bin
   npm view @osva-ai/connector-npm dependencies
   ```

7. **Clean install smoke** (outside the monorepo):

   ```powershell
   $smoke = Join-Path $env:TEMP "osva-npm-publish-smoke"
   New-Item -ItemType Directory -Force -Path $smoke | Out-Null
   Set-Location $smoke
   npm init -y
   npm install @osva-ai/connector-npm@0.1.0
   npx osva-connector-npm
   ```

   Connect with an MCP client; confirm `tools/list` returns exactly `npm_package_metadata` and `npm_downloads`.

8. **Trusted Publisher** on [npmjs.com](https://www.npmjs.com/) → **`@osva-ai/connector-npm`** → **Settings** → **Trusted Publisher** → **GitHub Actions** (package must exist from step 4):
   - **Organization or user:** `Osva-AI`
   - **Repository:** `osva-connectors`
   - **Workflow filename:** `npm-release-npm.yml` (filename only)
   - **Environment name:** `npm` (must match GitHub Environment and workflow `environment: npm`)
9. **Do not** use GitHub Actions to upload **`0.1.0`** after step 4 — that version is immutable once bootstrap completes. To exercise OIDC within npm’s Trusted Publisher window, publish the **next** semver via the workflow (see below), not a republish of `0.1.0`.

### Post-bootstrap registry verification

- [ ] `npm view @osva-ai/connector-npm@0.1.0 version` → `0.1.0`
- [ ] `npm view @osva-ai/connector-npm bin` → `osva-connector-npm` → `dist/stdio.js`
- [ ] GitHub Environment **`npm`** exists with required reviewers ([workflow](../.github/workflows/npm-release-npm.yml) is `workflow_dispatch` only)

## GitHub Actions (after manual bootstrap of `0.1.0`)

### Validation only — repeatable on `main`

Use this after `0.1.0` is on npm; **no registry upload**.

- [ ] **Actions → Release npm registry connector to npm** ([npm-release-npm.yml](../.github/workflows/npm-release-npm.yml))
  - `expected_version`: matches `packages/npm/package.json` (e.g. `0.1.0` while no bump has landed)
  - `dry_run`: **true**
  - `confirm_publish`: **false**

### Subsequent semver upload — OIDC (not for `0.1.0`)

When releasing **`0.1.1`** or later:

- [ ] Bump `packages/npm/package.json` `version` and `CONNECTOR_VERSION` in `src/constants.ts`; merge to **`main`**
- [ ] Confirm the new version is **not** on npm: `npm view @osva-ai/connector-npm@<version> version` → 404
- [ ] Run workflow with `dry_run=true` and `expected_version` = new semver
- [ ] Upload: `dry_run=false`, `confirm_publish=true`, after Environment **`npm`** approval
- [ ] Post-publish: `npm view @osva-ai/connector-npm@<version>` and clean install smoke from [INSTALL-NPM.md](./INSTALL-NPM.md)

**Note:** The workflow **refuses upload** if `expected_version` is already on the registry. You cannot republish **`0.1.0`** (or any immutable version) to “test” OIDC — use `dry_run=true` for packaging checks, or ship a **new patch** for the first OIDC upload.

After bootstrap only (no semver bump yet): promote **`latest`** if needed: `npm dist-tag add @osva-ai/connector-npm@0.1.0 latest` (if bootstrap used `stable-candidate`).

## Tarball checksum (local, before upload)

```powershell
cd packages\npm
pnpm pack --pack-destination $env:TEMP\osva-npm-pack
$tar = Get-ChildItem $env:TEMP\osva-npm-pack\osva-ai-connector-npm-0.1.0.tgz
Get-FileHash $tar.FullName -Algorithm SHA256
tar -tzf $tar.FullName
```

## Explicitly out of scope for automated publish

- No publish on push to `main` or on pull request CI
- No npm tokens in CI verify jobs (only release workflow + environment `npm`)
- No automatic GitHub Release tags
- Does not publish other `@osva-ai/connector-*` packages

## Pending until externally configured

- npm trusted publisher for `@osva-ai/connector-npm` (after bootstrap package exists)
- First successful manual `npm publish` bootstrap
- GitHub Environment `npm` approval gate
