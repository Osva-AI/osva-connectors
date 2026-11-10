# B5.0 OIDC Canary Plan

**Goal:** First human-approved npm upload via GitHub Actions OIDC trusted publishing—without `NPM_TOKEN`.

**Status:** Not executed in B5.0 (PROHIBITED).

## F-P2-15 / OIDC token parity (re-reviewed)

| Topic | Verdict |
| --- | --- |
| Workflows inject `NODE_AUTH_TOKEN: secrets.NPM_TOKEN` globally | **Resolved** in R0 — no workflow-level `NODE_AUTH_TOKEN:` assignment remains |
| Default auth path | **OIDC** via `scripts/release/configure-npm-publish-auth.mjs` + `run-npm-publish.mjs` |
| `use_npm_token` default | `false` — empty token does **not** fall through to OIDC |
| Dry-run proves OIDC | **No** — dry-run exercises pack/lint only; real publish required |
| Static tests | `pnpm test:release-workflows` — **29/29 PASSED** (2026-11-10) |

## Trusted publisher baseline

Source: `npm-trusted-publishers-audit.csv` (local; **UNVERIFIED** against npm admin UI in B5.0).

| Package | Workflow | Trust (CSV) |
| --- | --- | --- |
| `@osva-ai/connector-github` | `.github/workflows/npm-release.yml` | CONFIGURED |
| `@osva-ai/connector-ga4` | `npm-release-ga4.yml` | CONFIGURED |
| `@osva-ai/connector-npm` | `npm-release-npm.yml` | CONFIGURED |
| `@osva-ai/connector-postgres` | `npm-release-postgres.yml` | CONFIGURED |
| `@osva-ai/connector-shopify` | `npm-release-shopify.yml` | CONFIGURED |

All other 40 packages: **MISSING** — create publisher only when that package’s new version is ready (see `docs/R0-NPM-TRUSTED-PUBLISHING.md`).

## Five-way canary comparison

| Criterion | github | ga4 | npm | postgres | shopify |
| --- | --- | --- | --- | --- | --- |
| Trusted publisher | Yes | Yes | Yes | Yes | Yes |
| Unpublished R1–R3 code on `main` | **Yes** (allowlist) | No | No | No | No |
| Operational risk | Medium (mutations, PAT) | Medium (Google ADC) | Low | Low | Medium (shop token) |
| Acceptance strength | Strong | Strong | Strong | **Strong + Docker job** | Strong |
| Live provider for smoke | Optional | Yes | Low | **Docker Postgres** | Yes |
| Security blocker | None | GA4 scope = credential | None | None | None |
| Version delta | **0.4.0 minor** | — | — | optional 0.1.2 infra | — |

## Recommendation

| Role | Package | Proposed version | Rationale |
| --- | --- | --- | --- |
| **Primary** | `@osva-ai/connector-github` | **0.4.0** | Only CONFIGURED trusted publisher with substantive unpublished security delta (R3 repo allowlist); proves OIDC **and** ships meaningful fix |
| **Backup** | `@osva-ai/connector-postgres` | **0.1.2** (infra-only patch) | Lowest external risk; CONFIGURED publisher; use if GitHub canary blocked—requires explicit decision to bump without functional delta |

R0 suggested GitHub; B5.0 selects GitHub on **intersection of trusted publisher + unpublished change**, not R0 inertia alone.

## Primary canary — operator procedure (GitHub 0.4.0)

### Preconditions (human)

1. B5.1 landed on `main`: `package.json` / `CONNECTOR_VERSION` / workflow `expected_version` = `0.4.0`.
2. `main` CI green.
3. GitHub Environment `npm`: add **required reviewers** (`protection_rules` was empty on 2026-11-10).
4. Confirm trusted publisher on npmjs.com: `Osva-AI/osva-connectors` + `npm-release.yml` + environment `npm`.
5. Confirm `NPM_TOKEN` **absent** on environment (OIDC path).

### Dry-run (does not prove OIDC)

1. Actions → **Release to npm** (`npm-release.yml`).
2. `dry_run=true` (default), `confirm_publish=false`, `use_npm_token=false`, `expected_version=0.4.0`.
3. Expect: lint, build, pack success; **no** `npm publish`.

### Real OIDC publish

1. Dispatch again: `dry_run=false`, `confirm_publish=true`, `use_npm_token=false`, `expected_version=0.4.0`.
2. Approve environment review.
3. Watch logs for: `Publish authentication: OIDC trusted publishing` and **no** `NODE_AUTH_TOKEN` set in publish child env.
4. Failure must **not** silently fall back to token.

### Success conditions

```bash
npm view @osva-ai/connector-github@0.4.0 version
# => 0.4.0

npm dist-tag ls @osva-ai/connector-github
# latest => 0.4.0

npm view @osva-ai/connector-github@0.4.0 dist.attestations
# Provenance present when workflow uses --provenance (dry_run=false path)
```

### Failure handling

| Symptom | Action |
| --- | --- |
| OIDC / trusted publisher auth error | Fix publisher mapping; **do not** enable `use_npm_token` without human risk acceptance |
| Version already exists | Bump to next patch; never republish |
| Partial upload / interrupted publish | Inspect npm UI; bump version if immutability conflict |

### Post-publish verification

1. Registry tarball install per `B5_0_PUBLISHED_ACCEPTANCE_PLAN.md`.
2. `pnpm test:package-acceptance` against **installed** package (not workspace link).
3. MCP `initialize` + `tools/list` smoke.
4. Optional: allowlist env smoke with fake PAT in CI pattern.

## GitHub `npm` environment (read-only, 2026-11-10)

```json
{
  "name": "npm",
  "protection_rules": [],
  "deployment_branch_policy": null,
  "can_admins_bypass": true
}
```

**Manual:** Add reviewers before first real upload. Optionally restrict deployment branches to `main`.
