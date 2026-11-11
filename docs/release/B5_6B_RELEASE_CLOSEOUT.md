# B5.6B — Release audit, evidence consolidation, and final closeout

- **Repository:** Osva-AI/osva-connectors
- **Branch:** `feat/b5-6-release-closeout`
- **Milestone:** B5.6B (audit closeout; does not execute Linux CI or live providers)
- **Date:** 2026-11-11 (local)
- **Prior commit:** B5.6A published verification (`02827ed`)

---

## 1. Executive summary

B5.6B audits the full B5 program (B5.0–B5.6), consolidates release evidence, verifies npm registry metadata for all **45** connectors without repeating the full Windows install matrix, statically validates the Linux published-acceptance workflow, and records independent **three-gate** release decisions.

**Windows published npm acceptance:** **45/45 PASSED** (B5.6A evidence, unchanged).
**Legacy dist-tag gap:** Closed via **supplementary** registry audit — **45/45** `latest` matches workspace (see §5). B5.6A historical report still shows 27× `dist_tag_latest` **SKIPPED** by harness policy.
**Linux published acceptance:** **NOT_RUN** (workflow on branch; dispatch requires `main`).
**Live-provider operational acceptance:** **NOT_RUN** (harness healthy; no authorized live execution).

**PR readiness (B5.6 implementation):** **READY_FOR_B5_6_PR** — see §15. Does **not** claim Linux or live-provider gates passed.

---

## 2. B5 milestone evidence inventory

| Milestone | Intended outcome                                          | Implementation                                                                        | Verification                                                   | Evidence                                                             | Deferred                                      | Status                                                            |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| **B5.0**  | Release readiness audit, waves, gates                     | `docs/release/B5_0_*`, release workflows                                              | Registry snapshot, `test:release-workflows` (historical 29/29) | `B5_0_RELEASE_GATE.md`                                               | OIDC live canary was unverified at audit time | **COMPLETE** (historical plan; superseded by B5.2–B5.4 execution) |
| **B5.1**  | Version prep, canary runbooks                             | `B5_1_*` docs, checklist alignment                                                    | Workflow tests, version matrix                                 | `B5_1_VERSION_MATRIX.md`                                             | —                                             | **COMPLETE**                                                      |
| **B5.2**  | OIDC publishing canary                                    | Human workflow dispatch (not in agent scope)                                          | Registry provenance on wave packages                           | B5.6A provenance 18/18                                               | —                                             | **COMPLETE** (evidence via B5.6A)                                 |
| **B5.3**  | 18 corrected connector publications                       | Per-package `npm-release-*.yml`                                                       | Published versions on registry                                 | Version matrix §4                                                    | —                                             | **COMPLETE**                                                      |
| **B5.4**  | Published npm acceptance framework                        | `scripts/release/published-package-acceptance*.mjs`                                   | Unit tests + pilot runs                                        | `published-package-acceptance.test.mjs`                              | Full 45 matrix deferred to B5.6A              | **COMPLETE**                                                      |
| **B5.5**  | Live-provider acceptance harness (45 runners)             | `scripts/live-provider/*`, ops docs                                                   | 20 harness tests, matrix, pilot preflight                      | `B5_5D_ACCEPTANCE_CLOSEOUT.md`, local JSON under `audit-results/`    | Real provider HTTP/mutations                  | **COMPLETE** (framework); **NOT_RUN** (operational)               |
| **B5.6A** | Full Windows published acceptance + Linux workflow wiring | Linux workflow, summarize helper, B5.6A doc                                           | 45/45 Windows matrix, workflow tests 43→51 with B5.6B          | `B5_6A_PUBLISHED_RELEASE_VERIFICATION.md`, `b5-6a-windows-full.json` | Linux dispatch, postgres smoke URL            | **COMPLETE** (committed)                                          |
| **B5.6B** | Audit, registry gap, risk register, PR gate               | This doc, `B5_6B_RISK_REGISTER.md`, `registry-dist-tag-audit.mjs`, static Linux tests | Commands §14                                                   | Local registry audit JSON                                            | Linux run, live sandbox                       | **COMPLETE** (local; uncommitted)                                 |

Historical B5.0 statements (“27 unpublished”, “OIDC unverified”) are **not** carried forward — B5.3/B5.6A registry evidence supersedes them for release decisions.

---

## 3. Forty-five package publication status

All **45** `@osva-ai/connector-*` packages:

- Exist on `https://registry.npmjs.org`
- Workspace `package.json` version is resolvable as `name@version`
- `dist-tags.latest` equals workspace version (B5.6B audit)
- Windows published-artifact matrix: overall **PASSED** each (B5.6A)

Wave (**18**): `B5_WAVE_DIRECTORIES` in `published-package-acceptance-core.mjs`.
Legacy (**27**): No wave flag; prior publications at current semver.

Full matrix: `docs/release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md` §4, `docs/connector-catalog.json`.

---

## 4. Version, provenance, and registry matrix (B5.6B supplementary)

| Check                             | Result                  | Evidence                                                                |
| --------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Packages audited                  | 45/45                   | `pnpm audit:registry-dist-tags` → exit 0 (2026-11-11)                   |
| `latest` vs workspace             | 45/45 match             | `audit-results/published-acceptance/b5-6b-registry-dist-tag-audit.json` |
| Version on registry               | 45/45 resolvable        | Same audit                                                              |
| Provenance (`signatures-present`) | 45/45 at pinned version | Same audit (informational for legacy)                                   |
| Discrepancies                     | **0**                   | —                                                                       |

This **does not** replace B5.6A install/integrity checks; it closes the **dist_tag_latest** metadata gap only.

---

## 5. Windows published acceptance (B5.6A — canonical)

| Field                              | Value                                                        |
| ---------------------------------- | ------------------------------------------------------------ |
| Report                             | `audit-results/published-acceptance/b5-6a-windows-full.json` |
| Packages passed / failed / skipped | **45 / 0 / 0**                                               |
| Checks skipped (optional)          | **36**                                                       |
| Platform                           | `win32`, Node v24.13.1, concurrency 1                        |

### Skipped check categories (not upgraded to PASSED)

| Check             | Count | Reason                                                                                                                      |
| ----------------- | ----: | --------------------------------------------------------------------------------------------------------------------------- |
| `dist_tag_latest` |    27 | Harness policy for non-wave packages (see §4 supplementary audit)                                                           |
| `cli_probe`       |     8 | `google-ads`, `ga4`, `gmail`, `google-calendar`, `google-drive`, `google-sheets`, `gsc`, `npm` — exit 0 without credentials |
| `mcp_smoke`       |     1 | `@osva-ai/connector-postgres` — `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` unset                                             |

### Provenance (from B5.6A install matrix)

- B5 wave (**18**): mandatory **PASSED**
- Legacy (**27**): **PASSED** with `signatures-present` at tested versions (informational)

Summarize: `pnpm summarize:published-verification audit-results/published-acceptance/b5-6a-windows-full.json`

---

## 6. PostgreSQL published MCP smoke gap

- **Prerequisite:** `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` or `OSVA_CONNECTOR_POSTGRES_ACCEPTANCE_URL` pointing at an **operator-controlled** database (not auto-started by harness).
- **Safe environment:** Isolated Postgres instance; no production data; URL with least privilege; run published install smoke only in temp install dir (same as B5.6A harness).
- **Status:** Remains **SKIPPED** in B5.6A report until executed. Does not fail package overall (optional check).

---

## 7. Linux published acceptance status

| Item               | Status                                                     |
| ------------------ | ---------------------------------------------------------- |
| Workflow file      | `.github/workflows/published-package-acceptance-linux.yml` |
| Trigger            | `workflow_dispatch` only                                   |
| Static validation  | **PASSED** (`published-package-acceptance-linux.test.mjs`) |
| Execution on Linux | **NOT_RUN**                                                |

**Constraints:** GitHub requires the workflow on **default branch** before manual dispatch. Do **not** dispatch from feature branch.

### Static verification summary

- Node **24**, `ubuntu-24.04`, job timeout **180** min
- Uses `published-package-acceptance.mjs --all-connectors` (registry installs, not monorepo tarballs)
- `permissions: contents: read` only — no publish, no `id-token: write`
- Artifacts: JSON + MD uploaded `if: always()`
- No provider credentials or live-provider env in workflow

---

## 8. Live-provider operational readiness

| Check                                | Result                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Connectors with scenario runners     | **45**                                                                        |
| Infrastructure runners               | **8**                                                                         |
| SaaS runners                         | **37**                                                                        |
| `OSVA_LIVE_PROVIDER_EXECUTE` default | off (live **BLOCKED** without flag + creds)                                   |
| Live mutations                       | **disabled** (`OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED` not enabled in B5) |
| Mock vs live labeling                | Preflight/mock ≠ live PASS                                                    |
| Real provider execution              | **NOT_RUN**                                                                   |

Operational classification: **NOT_RUN** for live_read/live_mutation across matrix unless operator authorizes sandbox runs post-merge.

---

## 9. Security remediation status (program context)

- **R0–R3:** Completed prior to B5 (release workflows, security remediations, package acceptance).
- **B5 wave publications:** OIDC provenance verified on 18 packages (B5.6A).
- **Outstanding:** Live sandbox verification, Linux runtime, postgres published smoke, operator allowlist contracts (see `B5_6B_RISK_REGISTER.md`).

---

## 10. Deferred acceptance checks

1. Linux `workflow_dispatch` published matrix (Gate B).
2. Postgres published MCP smoke with integration URL.
3. Live-provider pilot + infrastructure/SaaS waves with sandbox credentials.
4. Optional: full Windows re-run with `--expect-latest` (registry audit already confirms tags).

---

## 11. Operator verification runbook (local, read-only)

```bash
pnpm audit:registry-dist-tags --json-out audit-results/published-acceptance/b5-6b-registry-dist-tag-audit.json
pnpm summarize:published-verification audit-results/published-acceptance/b5-6a-windows-full.json
pnpm test:release-workflows
pnpm test:published-package-acceptance
pnpm test:live-provider-acceptance
pnpm test:live-provider-acceptance:matrix
pnpm test:live-provider-acceptance:pilot
node scripts/live-provider/mutation-inventory-audit.mjs
pnpm format:check
git diff --check
```

Do **not** re-run `published-package-acceptance.mjs --all-connectors` unless reproducing evidence.

---

## 12. Post-merge Linux execution (human only)

After B5.6 merges to `main`:

```bash
gh workflow run published-package-acceptance-linux.yml --ref main
```

**Find the run:**

```bash
gh run list --workflow=published-package-acceptance-linux.yml --limit 5
gh run watch <run-id>
```

**Retrieve artifacts:**

```bash
gh run download <run-id> -n published-acceptance-linux
```

Inspect `linux-published-acceptance-*.json` / `.md` for 45-package outcomes. Failure should fail the job (harness exit code). Artifacts upload even on failure (`if: always()`).

---

## 13. Post-merge sandbox acceptance plan

1. Configure sandbox credentials per connector README (least privilege, allowlists).
2. Set `OSVA_LIVE_PROVIDER_EXECUTE=1` only on operator host or guarded CI — **not** in Linux published workflow.
3. Run pilot: `pnpm test:live-provider-acceptance:pilot` with execute flag and creds.
4. Run infrastructure batch: `node scripts/live-provider/live-provider-acceptance.mjs --infrastructure` (then enable live per connector policy).
5. Run SaaS batch: `--saas` or per-connector `--connector <slug>`.
6. Retain `audit-results/live-provider-acceptance/*.json` outside git.

Mutations require explicit mutation runner approval flags — remain off until product sign-off.

---

## 14. Final three-gate decisions

### Gate A — Published npm artifact readiness (Windows)

**PASSED** — 45/45 independent registry installs and required checks passed on Windows (B5.6A). Optional skips documented (§5); legacy dist-tags confirmed via §4 supplementary audit.

### Gate B — Cross-platform published readiness

| Platform | Status      |
| -------- | ----------- |
| Windows  | **PASSED**  |
| Linux    | **NOT_RUN** |

Framework on branch: **READY_FOR_MERGE** (static validation passed). Cross-platform claim: **NOT_READY** until §12 executes.

### Gate C — Live-provider operational readiness

**NOT_RUN** — Harness and inventory **PASSED** in CI/local tests; no authorized live provider verification.

---

## 15. B5.6B files changed (local, not committed by agent)

| File                                                          | Purpose                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `docs/release/B5_6B_RELEASE_CLOSEOUT.md`                      | This document                                                            |
| `docs/release/B5_6B_RISK_REGISTER.md`                         | Risk register                                                            |
| `scripts/release/registry-dist-tag-audit.mjs`                 | Lightweight registry audit                                               |
| `scripts/release/published-package-acceptance-linux.test.mjs` | Linux workflow static tests                                              |
| `scripts/release/summarize-published-verification.test.mjs`   | Summary helper tests                                                     |
| `scripts/release/summarize-published-verification.mjs`        | Exported `summarizePublishedReport`                                      |
| `package.json`                                                | `audit:registry-dist-tags`, extended `test:published-package-acceptance` |

B5.6A commit already includes: Linux workflow, B5.6A doc, summarize script, `.gitignore` for `audit-results/`.

---

## 16. PR readiness review (B5.6 vs `main`)

| Check                                     | Result                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Unintended connector package changes      | **None** (diff is release/docs/scripts only)                                    |
| Accidental version bumps                  | **None** in branch diff                                                         |
| npm publish / workflow dispatch           | **Not performed**                                                               |
| Provider mutations / live creds           | **Not performed**                                                               |
| Credential leakage                        | **None observed** in changed files                                              |
| Workflow publish permissions on Linux job | **Read-only**                                                                   |
| `audit-results/` staged                   | **No** (gitignored)                                                             |
| Untracked noise                           | `matrix-formatted.md`, `npm-trusted-publishers-audit.csv` — **exclude from PR** |

**Verdict:** **READY_FOR_B5_6_PR**

---

## 17. Engineering verification (B5.6B session)

| Command                                                                                                          | Exit | Result                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ---: | ---------------------------------------------------------- |
| `pnpm audit:registry-dist-tags --json-out audit-results/published-acceptance/b5-6b-registry-dist-tag-audit.json` |    0 | 45/45 OK, 0 mismatch, 0 blocked                            |
| `pnpm test:release-workflows`                                                                                    |    0 | **51/51** passed (incl. 4 Linux static + 4 summarize)      |
| `pnpm test:published-package-acceptance`                                                                         |    0 | **18/18** passed                                           |
| `pnpm test:live-provider-acceptance`                                                                             |    0 | **20/20** passed                                           |
| `pnpm test:live-provider-acceptance:matrix`                                                                      |    0 | 45-row matrix regenerated (doc reverted to avoid PR noise) |
| `pnpm test:live-provider-acceptance:pilot`                                                                       |    0 | live=false, executed=3, failed=0, blocked=3                |
| `node scripts/live-provider/mutation-inventory-audit.mjs`                                                        |    0 | inventory aligned                                          |
| `pnpm format:check`                                                                                              |    0 | pass after Prettier on B5.6B files                         |
| `git diff --check`                                                                                               |    0 | pass                                                       |

**Not run:** Full `published-package-acceptance.mjs --all-connectors` (B5.6A evidence reused). Linux workflow dispatch.

---

## 18. Required follow-up milestones

| ID                | Work                                                            |
| ----------------- | --------------------------------------------------------------- |
| B5.6C (suggested) | Linux workflow dispatch + artifact archival                     |
| B5.7 (suggested)  | Live-provider sandbox waves (read, then mutation policy review) |
| Optional          | Postgres published smoke with sandbox URL                       |
| Optional          | CLI fail-fast hardening for 8 skipped probes                    |

---

## 19. Final closeout decision

**B5.6 program implementation** is ready for human PR review and merge (**READY_FOR_B5_6_PR**).

**Full release readiness** for enterprise evaluators requiring Linux parity and live-provider proof remains **partial**:

- Gate A: **PASSED**
- Gate B: **NOT_RUN** (Linux)
- Gate C: **NOT_RUN** (live)

Agents must **not** commit, push, dispatch workflows, or publish npm. Human operator: local commit for B5.6B, then consolidated PR.
