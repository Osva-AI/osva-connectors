# Release checklist — `@osva-ai/connector-postgres`

Use this checklist for the **first public npm release (`0.1.0`)** and subsequent semver releases.

Publishing is **independent** from [`@osva-ai/connector-github`](./RELEASE-CHECKLIST.md) (separate workflow: [npm-release-postgres.yml](../.github/workflows/npm-release-postgres.yml)).

## Engineering verification (repository)

- [ ] `main` is green on [CI](../.github/workflows/ci.yml) for the release commit
- [ ] `pnpm format:check` passes
- [ ] `pnpm --filter @osva-ai/connector-postgres lint` and `typecheck` pass
- [ ] `pnpm --filter @osva-ai/connector-postgres test` passes (103+ unit tests)
- [ ] `pnpm --filter @osva-ai/connector-postgres build` produces `packages/postgres/dist`
- [ ] PostgreSQL 16 Docker fixture up; `pnpm test:package-acceptance:postgres` passes with `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` set
- [ ] Integration tests pass (`postgres-*integration.test.ts` on CI or locally)
- [ ] `pnpm verify:boundaries` passes
- [ ] `packages/postgres/package.json` `version` matches `CONNECTOR_VERSION` in `src/constants.ts`
- [ ] `git status` clean at release commit
- [ ] `git diff --check` clean

## Package contents

- [ ] `pnpm pack` in `packages/postgres` includes `dist/`, `README.md`, `LICENSE` (no `test/`, `docker/`, fixtures, or `.env`)
- [ ] `engines.node` is `>=24`
- [ ] `bin.osva-connector-postgres` is `dist/stdio.js` (no `./` prefix — npm must not strip the bin)
- [ ] `@osva-ai/connector-sdk` pin is the tested RC (`1.1.0-rc.2` unless compatibility work says otherwise)
- [ ] `@modelcontextprotocol/server@2.0.0` remains a **direct** dependency (stdio entry imports `@modelcontextprotocol/server/stdio`)

## npm registry (operator)

- [ ] **`@osva-ai` npm organization** — permission to publish **public** scoped packages
- [ ] Target version **not** already on npm (first release): `npm view @osva-ai/connector-postgres@0.1.0 version` → 404

### First publication bootstrap (required once)

npm **trusted publishing (OIDC) cannot create a brand-new package** — the package must exist on the registry before **Trusted Publisher** settings are available ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [npm/documentation#1926](https://github.com/npm/documentation/issues/1926)).

1. **Bootstrap `0.1.0` manually (one time)** from a maintainer machine with **npm login** (org **2FA** as required):
   - Repo root: `pnpm install --frozen-lockfile && pnpm --filter @osva-ai/connector-postgres build`
   - Confirm packaged acceptance (Docker PostgreSQL 16): set `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` and run `pnpm test:package-acceptance:postgres`
   - `cd packages/postgres`
   - Confirm version not on registry: `npm view @osva-ai/connector-postgres@0.1.0 version` → 404
   - Pre-flight (no upload):

     ```bash
     npm publish --dry-run --access public --provenance=false
     ```

     Must **not** warn that `bin[osva-connector-postgres]` was “invalid and removed”.

   - **First upload only** — disable provenance locally (no GitHub OIDC on a laptop):

     ```bash
     npm publish --access public --provenance=false
     ```

     Do **not** run this command until operator sign-off; it is documented here, not executed in automation.

2. **Trusted Publisher** on [npmjs.com](https://www.npmjs.com/) → **`@osva-ai/connector-postgres`** → **Settings** → **Trusted Publisher** → **GitHub Actions**:
   - **Organization or user:** `Osva-AI`
   - **Repository:** `osva-connectors`
   - **Workflow filename:** `npm-release-postgres.yml` (filename only)
   - **Environment name:** `npm`
3. Complete a **successful OIDC publish within 2 days** of creating the trusted publisher config, or npm may expire the config.

The GitHub connector keeps its **separate** trusted publisher pointing at `npm-release.yml` only.

### Post-bootstrap registry verification

- [ ] `npm view @osva-ai/connector-postgres@0.1.0 version` → `0.1.0`
- [ ] `npm view @osva-ai/connector-postgres bin` → `osva-connector-postgres` → `dist/stdio.js`
- [ ] Clean directory: `npm install @osva-ai/connector-postgres@0.1.0` and configure `OSVA_CONNECTOR_POSTGRES_URL` (see [INSTALL-POSTGRES.md](./INSTALL-POSTGRES.md))
- [ ] MCP: `tools/list` shows all **five** postgres tools; errors omit credentials and connection strings

- [ ] GitHub Environment **`npm`** exists with required reviewers ([workflow](../.github/workflows/npm-release-postgres.yml) is `workflow_dispatch` only)

## Publish via GitHub Actions (after bootstrap)

- [ ] Review [0.1.0 release notes](./releases/0.1.0-RELEASE-NOTES-postgres.md)
- [ ] **Actions → Release PostgreSQL to npm** ([npm-release-postgres.yml](../.github/workflows/npm-release-postgres.yml))
  - `expected_version`: `0.1.0`
  - First run: `dry_run=true` (repeatable even after `0.1.0` exists on npm)
  - Upload: `dry_run=false`, `confirm_publish=true`, after environment approval
- [ ] Post-publish: `npm view @osva-ai/connector-postgres@0.1.0`
- [ ] Post-publish: clean install smoke from [INSTALL-POSTGRES.md](./INSTALL-POSTGRES.md)

**Note:** You cannot republish an existing version to “test” OIDC. Use `dry_run=true` on the workflow, or publish a new patch version after bootstrap.

## Explicitly out of scope for automated publish

- No publish on push to `main` or on pull request CI
- No npm tokens in CI verify jobs (only release workflow + environment `npm`)
- No automatic GitHub Release tags
- Does not publish `@osva-ai/connector-github`

## Pending until externally configured

- npm trusted publisher for `@osva-ai/connector-postgres`
- First successful manual `npm publish` bootstrap
- GitHub Environment `npm` approval gate
