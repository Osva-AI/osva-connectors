# B5.1 Implementation Summary

**Branch:** `chore/b5-1-release-preparation`  
**Date:** 2026-11-10  
**Baseline:** `main` after B5.0 merge (PR #37 → `03aefd1`)

## Scope delivered

1. **Azure Blob** — `requestTimeoutMs` now drives every SDK call via `AbortSignal.timeout` / `runWithAbortSignal` (lists) and `abortSignal` on read/write/metadata operations. **RESOLVED_TESTED**
2. **BigQuery** — `requestTimeoutMs` enforced on metadata and query API paths; query lifecycle calls `job.cancel()` best-effort when client abort/timeout fires after job creation. README documents `QUERY_TIMEOUT_MS` vs `REQUEST_TIMEOUT_MS`. **RESOLVED_TESTED**
3. **18 release candidates** — semver bumps, `CONNECTOR_VERSION` sync, workflow `expected_version` defaults.
4. **Catalog** — `docs/connector-catalog.json` regenerated (45 entries).
5. **OIDC canary** — `@osva-ai/connector-github@0.4.0` packaged acceptance passed locally.

No npm publish, no trusted-publisher changes, no git commit/push.

## Source fixes (blockers)

| Package      | Change                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `azure-blob` | `request-abort-signal.ts`, `run-with-abort.ts`, `provider-sdk-client.ts` timeout budget              |
| `bigquery`   | `request-abort-signal.ts`, `run-with-abort.ts`, `provider-sdk-client.ts` request budget + job cancel |
| Both         | New `provider-sdk-request-budget.test.ts`                                                            |

## Version changes

| Tier          | Count | Details                                    |
| ------------- | ----: | ------------------------------------------ |
| `0.4.0` minor |     1 | `github` (R3 repo allowlist + OIDC canary) |
| `0.1.1` patch |    17 | R1–R3 deltas per B5.0 plan                 |
| Unchanged     |    27 | No manifest bumps                          |

## Compatibility

- **GitHub 0.4.0:** New optional `OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES`. Unset = prior fail-open behavior.
- **Other 0.1.1:** Patch fixes only; no intentional MCP breaking changes.

## Tests performed (local)

| Check                                         | Result                          |
| --------------------------------------------- | ------------------------------- |
| 18 × lint / typecheck / test / build          | **PASSED**                      |
| `pnpm test:release-workflows`                 | **PASSED** (29/29)              |
| `pnpm verify:package-acceptance-coverage`     | **PASSED**                      |
| `pnpm test:package-acceptance` (GitHub 0.4.0) | **PASSED**                      |
| `pnpm install --frozen-lockfile`              | **PASSED**                      |
| Registry check `@0.4.0` / `@0.1.1`            | **404** (unpublished, expected) |

## Remaining limitations

- Azure list pagination: client-side deadline only (Azure `byPage` does not accept `abortSignal`).
- BigQuery: server jobs may bill briefly after `job.cancel()`; metadata/query HTTP bounded by `requestTimeoutMs`, job cap by `jobTimeoutMs`.
- Packaged acceptance run only for **GitHub** canary; other 17 candidates rely on per-package unit tests (not full tarball MCP loop in B5.1).

## Gate

**READY_FOR_HUMAN_PR_REVIEW** — all 18 candidates release-ready; blockers resolved.
