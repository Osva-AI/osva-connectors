# B5.1 Release Verification Log

**Host:** Windows, Node 24, pnpm 12.4.1  
**Branch:** `chore/b5-1-release-preparation`

## Blocker remediation

| Item                                     | Classification      | Evidence                                                                             |
| ---------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ |
| Azure Blob `requestTimeoutMs`            | **RESOLVED_TESTED** | `provider-sdk-client.ts`; `provider-sdk-request-budget.test.ts`; 54 azure-blob tests |
| BigQuery `requestTimeoutMs` + job cancel | **RESOLVED_TESTED** | `provider-sdk-client.ts`; `provider-sdk-request-budget.test.ts`; 46 bigquery tests   |

## Infrastructure

| Command                                         | Status                  |
| ----------------------------------------------- | ----------------------- |
| `pnpm test:release-workflows`                   | **PASSED** (29/29)      |
| `pnpm verify:package-acceptance-coverage`       | **PASSED**              |
| `pnpm test:package-acceptance-coverage`         | **PASSED**              |
| `pnpm verify:boundaries`                        | **PASSED**              |
| `pnpm generate:connector-catalog`               | **PASSED** (45 entries) |
| `pnpm install --frozen-lockfile`                | **PASSED**              |
| `pnpm exec prettier --check` (changed packages) | **PASSED**              |
| `git diff --check`                              | **PASSED**              |

## 18 release candidates — per-package

| Status     | Scope                                                                             |
| ---------- | --------------------------------------------------------------------------------- |
| **PASSED** | `lint`, `typecheck`, `test`, `build` for all 18 filters (sequential run, ~18 min) |

## OIDC canary (GitHub)

| Check                                      | Status                                            |
| ------------------------------------------ | ------------------------------------------------- |
| `npm view @osva-ai/connector-github@0.4.0` | **404** (unpublished, expected)                   |
| `pnpm pack` `@0.4.0`                       | **PASSED** (67 entries in acceptance script)      |
| `pnpm test:package-acceptance`             | **PASSED** (`osva-ai-connector-github-0.4.0.tgz`) |

## Packaged acceptance (other 17)

| Status      | Notes                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| **SKIPPED** | Unit/build gates passed; full tarball MCP loop not re-run per package (defer to post-merge CI / human spot checks) |

## Registry / OIDC

| Item                   | Status                               |
| ---------------------- | ------------------------------------ |
| npm publish            | **NOT_PERFORMED**                    |
| Trusted publishers     | **UNMODIFIED**                       |
| OIDC upload in Actions | **UNVERIFIED** (awaits human canary) |
| Live provider smoke    | **DEFERRED** (L4)                    |

## Git safety

| Action               | Status            |
| -------------------- | ----------------- |
| commit / push / PR   | **NOT_PERFORMED** |
| Remote GitHub writes | **NONE**          |
