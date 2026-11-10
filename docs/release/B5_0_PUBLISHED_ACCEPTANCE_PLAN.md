# B5.0 Published-Artifact Acceptance Plan

**Purpose:** Verify packages **installed from the public npm registry**, not workspace builds.

**Scope:** Design for B5.1+ after each wave publish. B5.0 does **not** claim registry acceptance for unpublished versions.

## Principles

- Hermetic by default: fake providers / mocks; no production credentials.
- Isolated install directory per package (temp folder outside monorepo).
- Windows and Linux: run install on both when feasible (CI on Linux; local operator on Windows).
- Fail closed on stdout pollution, secret patterns, or MCP protocol errors.

## Reusable script plan

Add under `scripts/release/` (B5.1 implementation — **not created in B5.0**):

`published-package-acceptance.mjs <npm-package-name> <exact-version>`

### Steps (automated)

1. **Registry metadata**
   - `npm view <name>@<version> version --json`
   - `npm view <name>@<version> dist.integrity`
   - `npm view <name>@<version> dist.tarball`
   - Abort if version missing.

2. **Clean install**
   ```bash
   mkdir -p "$tmpdir/accept"
   cd "$tmpdir/accept"
   npm init -y
   npm install "<name>@<version>" --save-exact
   ```

3. **Integrity**
   - Compare `package-lock.json` integrity to registry `dist.integrity`.

4. **Artifact layout**
   - `test -f node_modules/<name>/dist/stdio.js`
   - `test -f node_modules/<name>/LICENSE`
   - Grep packed files: no `.env`, no `test/` in published tree (match release workflow checks).

5. **CLI**
   - `npx <bin-from-package.json> --help` or version probe if documented.

6. **MCP stdio smoke** (reuse patterns from `scripts/package-acceptance*.mjs`)
   - Spawn connector with minimal env from fake fixtures.
   - Send JSON-RPC `initialize` → expect capabilities.
   - `tools/list` → count tools ≥ documented minimum.
   - One `tools/call` against fake provider fixture if available.
   - No non-JSON lines on stdout (protocol pollution check).
   - Process exit 0 on shutdown.

7. **Secrets scan (lightweight)**
   - Grep install tree for `AKIA`, `sk_live`, `ghp_`, `Bearer ey` patterns — fail if found.

8. **Provenance** (when available)
   ```bash
   npm view "<name>@<version>" dist.attestations
   ```

9. **Dist-tag**
   - `npm dist-tag ls <name>` — confirm `latest` points at intended version after publish.

### Windows notes

- Use `npm.cmd` / `shell: true` only where existing smokes do (R3 F-P2-16).
- Path separators in temp dir via `os.tmpdir()`.

### Postgres special case

- Optional second stage: Docker Postgres + `package-acceptance-postgres.mjs` against **installed** binary path (`node_modules/.bin/...`).

## Manual operator checklist (first canary)

```bash
PKG=@osva-ai/connector-github
VER=0.4.0
TMP=$(mktemp -d)
cd "$TMP"
npm init -y
npm install "${PKG}@${VER}"
node -e "require('fs').accessSync('node_modules/${PKG#/}/dist/stdio.js')"
npx "${PKG}"  # if bin resolves; else node node_modules/.../dist/stdio.js with MCP handshake script
```

## CI integration (future)

- Not gated on every PR (slow + registry rate limits).
- Post-publish GitHub Actions job triggered manually or from release workflow success artifact.
- Matrix: `{package, version}` one row per publish event.

## What this does not replace

- L4 live provider acceptance (`audit-results/.../LIVE_PROVIDER_ACCEPTANCE_PLAN.md`).
- Workspace `pnpm test:package-acceptance:*` (L3 packaged source).

## Success criteria (per published version)

| # | Check |
| --- | --- |
| 1 | Version exists on registry |
| 2 | Tarball integrity matches lockfile |
| 3 | Dependencies resolve on Node 24 |
| 4 | `dist/stdio.js` present |
| 5 | MCP initialize OK |
| 6 | tools/list OK |
| 7 | Representative tools/call OK (fake) |
| 8 | No secret leak patterns |
| 9 | Clean shutdown |
| 10 | Attestations when OIDC publish used |
| 11 | Correct `latest` tag |
