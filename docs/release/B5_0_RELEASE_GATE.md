# B5.0 Release Gate — OSVA Connectors

**Date:** 2026-11-10
**Branch audited:** `chore/b5-release-readiness` (HEAD aligns with `main` at `5aff8fc`, R3 PR #36)
**Baseline:** Registry publication snapshot ~SHA `1810896` (pre–R0–R3 security/remediation)
**Mode:** Audit and planning only — no publication performed

## Executive summary

| Metric                                                                     |                                Value |
| -------------------------------------------------------------------------- | -----------------------------------: |
| Connector packages inventoried                                             |                                   45 |
| On npm registry (`latest` resolvable)                                      |                              45 / 45 |
| Repo `package.json` version === npm `latest` (string match)                |                              45 / 45 |
| Packages with **source changes** since registry baseline (`1810896..HEAD`) |                                   18 |
| Packages **not** requiring a functional republication                      |                                   27 |
| Program-wide **security** release blockers (CRITICAL/HIGH bypass)          |                                    0 |
| Per-package **reliability** blockers                                       | 2 (azure-blob, bigquery — see below) |
| Trusted publishers **CONFIGURED** (local CSV; npm UI unverified)           |                                    5 |
| Trusted publishers **MISSING**                                             |                                   40 |
| OIDC workflow static readiness (R0 + `pnpm test:release-workflows`)        |                       PASSED (29/29) |
| OIDC publish **VERIFIED** in Actions                                       |         UNVERIFIED (no human canary) |
| R3 CI on `main` after merge                                                |        PASSED (`42819159625`, 8m27s) |
| Packaged acceptance CI coverage                                            |                              45 / 45 |

**Published npm tarballs are stale for 18 connectors:** version strings match the registry, but `main` contains unpublished R1–R3 security and correctness fixes. Do not infer artifact equivalence from identical semver.

**Gate decision:** `READY_FOR_B5_1` — controlled version-bump and publication preparation may proceed. First npm upload still requires human OIDC canary, trusted-publisher registration for 40 packages, and optional per-package fixes (azure-blob / bigquery) before those two ship.

---

## B5.0A — Security release gate

### Security verdicts

| Connector              | Finding                                                                             | Evidence                                                | Severity      | Release blocker     | Required action                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| GA4                    | No connector property allowlist; `OSVA_CONNECTOR_GA4_PROPERTY_ID` is default only   | `resolve-property.ts`, `connector.ts`, README §Security | MEDIUM        | ACCEPTED_LIMITATION | Document operator contract; narrow Google IAM; optional future `ALLOWED_PROPERTIES`         |
| Stripe                 | Optional customer allowlist does not filter unfiltered lists or `paymentIntent.get` | `customer-allowlist.ts`, `connector.ts`, README         | MEDIUM        | ACCEPTED_LIMITATION | Restricted read keys + ToolPolicy; extend allowlist in future if product promises isolation |
| Shopify                | Shop binding via `parseShopHost`; no cross-shop path in code                        | `parse-shop-host.ts`, `config.ts`                       | LOW           | NON_BLOCKING        | Ensure shop token pairing in ops docs                                                       |
| GitHub                 | Optional repo allowlist enforced on all 5 tools when non-empty                      | `repository-allowlist.ts`, `connector.ts:81–222`        | INFORMATIONAL | NON_BLOCKING        | Ship **0.4.0** with `OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES`                            |
| GitHub                 | Empty/unset allowlist = fail-open (credential scope only)                           | `repository-allowlist.ts:12–13`                         | LOW           | NON_BLOCKING        | Ops: set non-empty list for multi-workspace                                                 |
| Qdrant                 | R2 IPv6/ULA HTTPS block in place                                                    | `qdrant-base-url.ts`, tests                             | INFORMATIONAL | NON_BLOCKING        | None for IPv6 item                                                                          |
| Qdrant                 | DNS rebinding / fetch redirects / `https://localhost` not fully pinned              | `qdrant-rest-client.ts`                                 | MEDIUM        | ACCEPTED_LIMITATION | Trusted Qdrant URL; follow-up hardening optional                                            |
| BigQuery               | R1 COUNT column / allowlist SQLi remediated                                         | `identifier.ts`, `query-security.test.ts`               | N/A           | NON_BLOCKING        | Publish **0.1.1** with R1 fixes                                                             |
| Storage (S3/GCS/Azure) | R1 list prefix allowlist bypass remediated                                          | `resource-scope.ts` (shared pattern)                    | N/A           | NON_BLOCKING        | Publish patches for changed packages                                                        |
| Supabase               | R2 malformed JWT fail-closed                                                        | `jwt-policy.ts`                                         | N/A           | NON_BLOCKING        | Publish **0.1.1**                                                                           |

No confirmed **unauthorized cross-tenant data access** bypass was found in connector enforcement layers beyond documented credential-scope behavior.

---

## B5.0B — Reliability and operational gate

| Connector / area | Failure scenario                                                                 | User impact                           | Probability | Severity | Workaround                             | Evidence                                        | Blocker         | Milestone                                       |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------- | ----------- | -------- | -------------------------------------- | ----------------------------------------------- | --------------- | ----------------------------------------------- |
| GCS              | `listBuckets` / `listObjects` / `listObjectVersions` lack per-call SDK `timeout` | Long hung list MCP call               | Medium      | MEDIUM   | Bucket/prefix allowlists; process kill | `provider-sdk-client.ts` L31–33 comment + tests | NON_BLOCKING    | B5.3+ docs                                      |
| AWS S3 / Azure   | List/metadata mutations lack `AbortSignal`; S3 relies on SDK retry               | Cancelled call may continue I/O       | Medium      | LOW      | Timeouts on read path (S3); allowlists | `connector.ts`, `provider-sdk-client.ts`        | NON_BLOCKING    | Defer F-P2-04                                   |
| Azure Blob       | `requestTimeoutMs` env **unused** in SDK client                                  | Operator believes timeout is enforced | High        | MEDIUM   | External watchdog                      | `provider-sdk-client.ts` vs `config.ts`         | **Per-package** | Fix before **0.1.1** ship or document in README |
| BigQuery         | `requestTimeoutMs` env **unused**                                                | Misleading config                     | High        | MEDIUM   | `jobTimeoutMs` only                    | `provider-sdk-client.ts`                        | **Per-package** | Fix or README before ship                       |
| BigQuery         | MCP abort does not cancel running query job                                      | Cost after client cancel              | Medium      | MEDIUM   | None in connector                      | `runQuery` ignores `signal`                     | NON_BLOCKING    | Defer F-P2-11                                   |
| Snowflake        | R1 `statement.cancel()` + bounded stream                                         | —                                     | —           | —        | —                                      | `provider-sdk-client.ts`, tests                 | NON_BLOCKING    | Publish **0.1.1**                               |
| Snowflake        | Query gate wait not abort-aware                                                  | Stall on concurrency gate             | Low         | LOW      | —                                      | `query-gate.ts`                                 | NON_BLOCKING    | Defer                                           |

**Mutation retry (R2):** github, linear, notion, intercom — `retryable: false` on ambiguous writes verified in R2. Storage mutations use conditional writes, not R2 REST pattern.

---

## CI and verification status

| Check                                                                        | Result                             |
| ---------------------------------------------------------------------------- | ---------------------------------- |
| `main` CI after R3 merge (#36)                                               | **PASSED**                         |
| `pnpm verify:package-acceptance-coverage` (2026-11-10 local)                 | **PASSED** (45 connectors)         |
| `pnpm test:release-workflows` (2026-11-10 local)                             | **PASSED** (29/29)                 |
| Fresh `npm view` all 45 (`audit-results/.../npm-registry.json`, `13:13:31Z`) | **PASSED** (45 found, 0 errors)    |
| Shard B full local `test:package-acceptance:ci-shard-b`                      | **SKIPPED** (deferred to CI)       |
| Live provider L4 smoke                                                       | **UNVERIFIED**                     |
| Registry tarball byte-for-byte vs `main`                                     | **UNVERIFIED** (planned B5.1)      |
| npm trusted publisher live registry query                                    | **UNVERIFIED** (CSV baseline only) |

---

## Publication dependencies

1. **B5.1:** Version bumps + `CONNECTOR_VERSION` + workflow `expected_version` sync (no publication).
2. **Human:** npm environment required reviewers (currently empty — `GET environments/npm`).
3. **Human:** OIDC canary on one CONFIGURED trusted publisher (see `B5_0_OIDC_CANARY_PLAN.md`).
4. **Human:** Create trusted publisher per package immediately before each new version (40 remaining).
5. **B5.1+:** Published-artifact acceptance from registry (see `B5_0_PUBLISHED_ACCEPTANCE_PLAN.md`).

---

## Release decision

**`READY_FOR_B5_1`**

Rationale: No program-wide security blocker; workflows and acceptance gates are green; eighteen packages need semver bumps to expose R1–R3 fixes. Remaining gaps (OIDC never proven, dead timeout config on two packages, GA4/Stripe documented scope limits) are either operational, accepted limitations, or per-package publish gates—not grounds to halt the preparation milestone.
