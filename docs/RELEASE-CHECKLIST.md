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
- [ ] `@osva-ai/connector-sdk` remains the tested RC pin (`1.1.4` unless compatibility work says otherwise)

## npm registry (operator)

- [ ] **`@osva-ai` npm organization** exists and you have permission to publish **public** scoped packages (`publishConfig.access: public` is set in `package.json`)
- [ ] Target version **not** already on npm: `npm view @osva-ai/connector-github@<version> version` → 404

### First publication bootstrap (required once)

npm **trusted publishing (OIDC) cannot create a brand-new package** — the package must exist on the registry before you can open its **Trusted Publisher** settings. Evidence: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/) (package settings) and [npm/documentation#1926](https://github.com/npm/documentation/issues/1926).

1. **Bootstrap `0.3.0` manually (one time):** from a maintainer machine with **npm login** (and org **2FA** / token policy as required by `@osva-ai`):
   - Repo root: `pnpm install --frozen-lockfile && pnpm build`
   - `cd packages/github`
   - Confirm version not on registry: `npm view @osva-ai/connector-github@0.3.0 version` → 404
   - **Disable provenance for this invocation only** — `publishConfig.provenance: true` makes npm generate provenance on publish; local Windows/macOS shells have no GitHub Actions OIDC provider and fail with `Automatic provenance generation not supported for provider: null`. CI releases keep `--provenance` in [npm-release.yml](../.github/workflows/npm-release.yml).
   - Verified bootstrap command (npm 11.5.1+):

     ```powershell
     npm publish --access public --provenance=false
     ```

     (POSIX: same flags.)

   - Pre-flight (no upload): `npm publish --dry-run --access public --provenance=false` — must **not** warn that `bin[osva-connector-github]` was “invalid and removed”. The bin map must be `"dist/stdio.js"` (no `./` prefix).
2. On [npmjs.com](https://www.npmjs.com/) → **`@osva-ai/connector-github`** → **Settings** → **Trusted Publisher** → **GitHub Actions**, set:
   - **Organization or user:** `Osva-AI`
   - **Repository:** `osva-connectors`
   - **Workflow filename:** `npm-release.yml` (filename only, must match [`.github/workflows/npm-release.yml`](../.github/workflows/npm-release.yml))
   - **Environment name:** `npm` (must match the workflow `environment:`)
3. Complete a **successful OIDC publish within 2 days** of creating the trusted publisher config, or npm expires the config ([npm docs](https://docs.npmjs.com/trusted-publishers/)).

Subsequent releases: use the GitHub **Release to npm** workflow with **trusted publishing + provenance** (`npm publish --provenance --access public` on Ubuntu after npm 11.5.1+). **`NPM_TOKEN`** on environment `npm` remains an optional fallback if OIDC is unavailable.

### Post-bootstrap registry verification

After the first successful upload:

- [ ] `npm view @osva-ai/connector-github@0.3.0 version` → `0.3.0`
- [ ] `npm view @osva-ai/connector-github bin` → `osva-connector-github` → `dist/stdio.js`
- [ ] Empty directory: `npm install @osva-ai/connector-github@0.3.0` then `npx osva-connector-github` with a test token (or follow [INSTALL.md](./INSTALL.md))
- [ ] MCP host or `pnpm test:package-acceptance`-equivalent: `tools/list` shows all **five** GitHub tools; stdout stays JSON-RPC-clean when the token is missing

- [ ] GitHub Environment **`npm`** exists with required reviewers (workflow is `workflow_dispatch` only — not PR CI)

## Publish (manual — after checklist)

### M19.3 patch (`0.3.1`) — SDK `1.1.4` realignment

- [ ] Confirm patch is **not** on npm: `npm view @osva-ai/connector-github@0.3.1 version` → 404
- [ ] Draft release notes reviewed ([0.3.1 draft](./releases/0.3.1-RELEASE-NOTES.md))
- [ ] Run [Release to npm](../../.github/workflows/npm-release.yml) via **Actions → Run workflow**
  - `expected_version`: **`0.3.1`** (must match `packages/github/package.json`)
  - `dry_run`: **true** first (`npm publish --dry-run`)
  - Upload: `dry_run=false`, `confirm_publish=true`, after **Environment `npm`** approval
- [ ] Post-publish: `npm view @osva-ai/connector-github@0.3.1` and tarball dependency `@osva-ai/connector-sdk@1.1.4`
- [ ] Post-publish: `npm dist-tag add @osva-ai/connector-github@0.3.1 latest` (if needed)
- [ ] Post-publish: clean install smoke from [INSTALL.md](./INSTALL.md)

Historical first publish (`0.3.0` bootstrap): [0.3.0 draft](./releases/0.3.0-RELEASE-NOTES.md) — **do not republish**.

## Explicitly out of scope for automated publish

- No publish on push to `main`
- No publish on pull request CI
- No npm tokens in CI verify jobs
- No GitHub **Release** tag created automatically by the npm workflow (create tags/releases separately if desired)

## Pending until externally configured

- npm trusted publisher / `npm` environment approval (not verifiable in-repo)
- First successful `npm publish` (not executed during C3.3 implementation)
