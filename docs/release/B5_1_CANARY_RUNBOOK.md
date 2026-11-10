# B5.1 OIDC Canary Runbook — `@osva-ai/connector-github@0.4.0`

Human-only steps. **Do not execute from automation.**

## Pre-merge (local / PR)

- [x] Repo version `0.4.0` (`package.json`, `CONNECTOR_VERSION`, `npm-release.yml` default)
- [x] `pnpm test:package-acceptance` (local tarball MCP)
- [ ] Human opens PR from `chore/b5-1-release-preparation` → `main`
- [ ] Human confirms GitHub Actions CI green on PR

## GitHub environment

1. Open https://github.com/Osva-AI/osva-connectors/settings/environments/npm
2. Add **required reviewers** (empty as of B5.0).
3. Confirm **no** `NPM_TOKEN` secret (OIDC default).

## npm trusted publisher (verify, do not recreate)

| Field         | Value                               |
| ------------- | ----------------------------------- |
| Package       | `@osva-ai/connector-github`         |
| Org / repo    | `Osva-AI` / `osva-connectors`       |
| Workflow file | `.github/workflows/npm-release.yml` |
| Environment   | `npm`                               |

## Dry-run (does **not** prove OIDC)

1. Actions → **Release to npm**
2. Inputs: `expected_version=0.4.0`, `dry_run=true`, `confirm_publish=false`, `use_npm_token=false`
3. Expect: lint, build, pack success; **no** registry upload

## OIDC publish

1. Merge approved changes to `main`; CI green
2. Dispatch **Release to npm**: `expected_version=0.4.0`, `dry_run=false`, `confirm_publish=true`, `use_npm_token=false`
3. Approve `npm` environment
4. Log must show: `Publish authentication: OIDC trusted publishing` (no silent `NODE_AUTH_TOKEN`)

## Post-publish verification

```bash
npm view @osva-ai/connector-github@0.4.0 version
npm dist-tag ls @osva-ai/connector-github
npm view @osva-ai/connector-github@0.4.0 dist.attestations
```

Install smoke: see `docs/release/B5_0_PUBLISHED_ACCEPTANCE_PLAN.md`.

## Failure handling

| Failure                       | Action                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------- |
| OIDC / trusted publisher auth | Fix publisher mapping; do **not** enable `use_npm_token` without risk acceptance |
| Version exists                | Bump to next version; never republish                                            |
| Partial upload                | Inspect npm; new immutable version only                                          |

Record evidence in release notes / audit folder (human).
