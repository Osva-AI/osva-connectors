# B5.6B — Consolidated risk register

- **Repository:** Osva-AI/osva-connectors
- **Branch:** `feat/b5-6-release-closeout`
- **Date:** 2026-11-11 (local audit)
- **Evidence basis:** B5.6A Windows acceptance, B5.6B registry metadata audit, B5.5 harness tests, static workflow review

Severity: **CRITICAL** | **HIGH** | **MEDIUM** | **LOW**. Release blocker: **YES** only when published-artifact or provenance gates are unmet.

---

## Release and packaging

| ID       | Description                                                          | Severity | Affected                | Mitigation                                                            | Evidence                                           | Status                        | Required action                                                                              | Owner       | Blocker |
| -------- | -------------------------------------------------------------------- | -------- | ----------------------- | --------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- | ----------- | ------- |
| R-PKG-01 | Linux published npm acceptance not executed                          | MEDIUM   | All 45                  | `published-package-acceptance-linux.yml` on `main`; operator dispatch | Static workflow tests; B5.6A §10                   | **NOT_RUN**                   | Dispatch post-merge; retain CI artifacts                                                     | Release ops | NO      |
| R-PKG-02 | PostgreSQL published MCP smoke skipped (no integration URL)          | LOW      | `connector-postgres`    | Documented skip; sandbox URL optional                                 | B5.6A JSON `mcp_smoke` SKIPPED                     | **SKIPPED**                   | Provide isolated `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` or accept registry-only exception | Release ops | NO      |
| R-PKG-03 | CLI fail-fast probe skipped (exit 0 without credentials)             | LOW      | 8 Google/npm connectors | Optional check; documented                                            | B5.6A: ga4, gsc, gmail, google-* , google-ads, npm | **SKIPPED**                   | Product hardening or accept limitation                                                       | Connector   | NO      |
| R-PKG-04 | Legacy `dist_tag_latest` skipped in Windows harness (policy)         | LOW      | 27 legacy               | B5.6B registry audit verified `latest` === workspace for all 45       | `b5-6b-registry-dist-tag-audit.json`               | **MITIGATED** (supplementary) | None for gate; historical report unchanged                                                   | Release ops | NO      |
| R-PKG-05 | Historical B5.0 trusted-publisher CSV may be stale vs current npm UI | LOW      | Publication ops         | Human OIDC canary + 18/18 provenance on wave                          | B5.6A provenance PASS                              | **ACCEPTED**                  | Refresh publisher inventory when rotating CI                                                 | Release ops | NO      |
| R-PKG-06 | Registry unreachable blocks lightweight audits                       | MEDIUM   | All 45                  | Fail closed; retry                                                    | `registry-dist-tag-audit.mjs` exit 1 when BLOCKED  | **N/A** (2026-11-11 audit OK) | Re-run audit if registry outage                                                              | Release ops | NO      |

---

## Provider integration

| ID       | Description                                                    | Severity | Affected                    | Mitigation                              | Evidence                        | Status                  | Required action                              | Owner        | Blocker |
| -------- | -------------------------------------------------------------- | -------- | --------------------------- | --------------------------------------- | ------------------------------- | ----------------------- | -------------------------------------------- | ------------ | ------- |
| R-PRV-01 | No authorized live-provider sandbox acceptance                 | HIGH     | All 45                      | B5.5 harness; gates default off         | B5.5D closeout; pilot blocked=3 | **NOT_RUN**             | Post-merge operator waves with sandbox creds | Provider ops | NO*     |
| R-PRV-02 | Credential scope and allowlist gaps (documented per connector) | MEDIUM   | GA4, Stripe, GitHub, others | README + ToolPolicy; B5.0 security gate | `B5_0_RELEASE_GATE.md`          | **ACCEPTED_LIMITATION** | Operator contracts                           | Connector    | NO      |
| R-PRV-03 | Provider cost, quota, and timeout behavior unverified live     | MEDIUM   | DB/storage/SaaS             | Allowlists, harness timeouts            | Mock/preflight only             | **NOT_RUN**             | Scoped live_read in sandbox                  | Provider ops | NO      |
| R-PRV-04 | Cross-tenant restrictions depend on operator env configuration | MEDIUM   | Multi-tenant SaaS           | Env allowlists                          | Code + B5.5 matrix              | **NOT_RUN** live        | Sandbox tests with tight allowlists          | Provider ops | NO      |

\* Blocks **operational** readiness claims, not published npm artifact gate.

---

## Mutation safety

| ID       | Description                                           | Severity | Affected                        | Mitigation                                           | Evidence           | Status                  | Required action                           | Owner        | Blocker |
| -------- | ----------------------------------------------------- | -------- | ------------------------------- | ---------------------------------------------------- | ------------------ | ----------------------- | ----------------------------------------- | ------------ | ------- |
| R-MUT-01 | Heuristic mutation classification may mis-label tools | MEDIUM   | Mutation-capable connectors     | `mutation-inventory-audit.mjs`; unknown fails closed | B5.5 harness tests | **MITIGATED** (static)  | Live mutation scenarios per tool (future) | Provider ops | NO      |
| R-MUT-02 | Live mutation runner disabled by default              | LOW      | All                             | `OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED` off     | B5.5D §5           | **MITIGATED**           | Explicit operator enable + approval       | Provider ops | NO      |
| R-MUT-03 | Idempotency/retry limits on destructive writes        | MEDIUM   | github, linear, notion, storage | R2 `retryable: false` on ambiguous writes            | R2 remediation     | **ACCEPTED_LIMITATION** | Document in operator runbooks             | Connector    | NO      |

---

## Mock and evidence

| ID       | Description                                              | Severity | Affected     | Mitigation                                          | Evidence     | Status                  | Required action                    | Owner       | Blocker |
| -------- | -------------------------------------------------------- | -------- | ------------ | --------------------------------------------------- | ------------ | ----------------------- | ---------------------------------- | ----------- | ------- |
| R-EVD-01 | `audit-results/` gitignored — evidence not in VCS        | LOW      | All audits   | Local + CI artifact retention                       | `.gitignore` | **ACCEPTED**            | Attach artifacts to release record | Release ops | NO      |
| R-EVD-02 | Uneven mock network isolation coverage across connectors | LOW      | SaaS subset  | GitHub mock isolation tested; others preflight-only | B5.5D Tier 3 | **ACCEPTED**            | Expand mock paths as needed        | Engineering | NO      |
| R-EVD-03 | Log redaction limits for novel secret formats            | LOW      | Live harness | Redaction helpers in harness                        | B5.5A        | **ACCEPTED_LIMITATION** | Extend patterns on incident        | Engineering | NO      |

---

## Release blocker summary

| Gate                          | Blocker risks | Verdict                           |
| ----------------------------- | ------------- | --------------------------------- |
| A — Published npm (Windows)   | None open     | **READY**                         |
| B — Cross-platform published  | R-PKG-01      | **NOT_READY** (Linux **NOT_RUN**) |
| C — Live-provider operational | R-PRV-01      | **NOT_READY** (**NOT_RUN**)       |
