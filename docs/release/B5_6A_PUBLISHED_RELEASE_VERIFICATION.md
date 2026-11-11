# B5.6A — Published Release Verification

- **Repository:** Osva-AI/osva-connectors
- **Branch:** `feat/b5-6-release-closeout`
- **Evidence commit (base):** `0e50bde5b455fe48a6ca607a5ccab3abd2b7b493`
- **Verification date:** 2026-11-11 (local)
- **Milestone:** B5.6A (published npm artifact verification — not live-provider operational acceptance)

---

## 1. Executive summary

B5.6A consolidates **independently reproducible evidence** that all **45** `@osva-ai/connector-*` packages on the public npm registry match workspace `package.json` versions and pass the B5.4 published-artifact acceptance matrix on **Windows**. Release workflow integrity and B5.5 harness health were re-verified locally. **Linux** published-artifact acceptance is **wired but not executed** (operator `workflow_dispatch` only). **Live-provider** operational acceptance remains **NOT_RUN** by policy.

**Gate decision (B5.6A scope):** **READY_FOR_B5_6A_LOCAL_COMMIT** — implementation and Windows evidence are complete for human review; cross-platform and live-provider gates are explicitly separate (see §15).

---

## 2. Release verification inventory (reused vs deferred)

| #   | Category                       | Implementation                                                                               | B5.6A use                                                                  |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Published artifact checks      | `scripts/release/published-package-acceptance.mjs` + `published-package-acceptance-core.mjs` | **EXECUTED** (45/45 Windows)                                               |
| 2   | npm registry metadata          | `registry_version`, `registry_integrity`, `manifest_metadata` checks                         | **EXECUTED**                                                               |
| 3   | OIDC provenance                | `parseProvenanceStatus` (mandatory for B5 wave via `target.wave`)                            | **EXECUTED** — 18/18 wave **PASSED** (`signatures-present`)                |
| 4   | Version & dist-tag consistency | Workspace versions + `dist_tag_latest` (wave packages assert latest)                         | **EXECUTED** — 18 wave **PASSED**; 27 legacy dist-tag **SKIPPED** (policy) |
| 5   | Packaged MCP acceptance        | Per-connector `package-acceptance-*-smoke.mjs` via isolated install                          | **EXECUTED** — 44 **PASSED**, postgres **SKIPPED** (no integration URL)    |
| 6   | Windows verification           | Full matrix local run                                                                        | **PASSED**                                                                 |
| 7   | Linux verification             | `.github/workflows/published-package-acceptance-linux.yml`                                   | **NOT_RUN** (human dispatch required)                                      |
| 8   | Live-provider operational      | `scripts/live-provider/*`                                                                    | **NOT_RUN** / **BLOCKED** (no `OSVA_LIVE_PROVIDER_EXECUTE=1`)              |
| 9   | Release workflow & CI          | `pnpm test:release-workflows`, `.github/workflows/npm-release*.yml`, `ci.yml`                | **PASSED** (static + unit gates)                                           |
| 10  | Deferred security / ops risks  | Live mutations, legacy provenance policy, postgres published smoke                           | **DOCUMENTED** (§13–§14)                                                   |

Historical planning docs (`docs/release/B5_0_*`, `B5_1_*`) are **inventory only** — not execution evidence for this milestone.

---

## 3. Registry verification methodology

1. **Version source of truth:** `packages/*/package.json` via `loadConnectorPackages` / `buildConnectorTargets` (no invented versions).
2. **Registry queries:** `npm view` against `https://registry.npmjs.org` (`classify-npm-view-result.mjs`).
3. **Isolated install:** Temp directories under OS temp (outside monorepo); dedicated npm cache per run.
4. **Checks:** Registry version/integrity, `npm install`, lockfile integrity, artifact layout, bin shims, secrets scan, provenance, dist-tag (wave), CLI probe, MCP smoke scripts (mocked — no provider credentials).
5. **Concurrency:** `1` (controlled; no parallel heavyweight matrices).
6. **Evidence:** JSON + Markdown under `audit-results/published-acceptance/` (gitignored — not committed).

**Regenerate summary from JSON:**

```bash
node scripts/release/published-package-acceptance.mjs --all-connectors \
  --json-out audit-results/published-acceptance/b5-6a-windows-full.json \
  --md-out audit-results/published-acceptance/b5-6a-windows-full.md

pnpm summarize:published-verification audit-results/published-acceptance/b5-6a-windows-full.json
```

---

## 4. Forty-five package version matrix (workspace = target npm version)

| Package                              | Version | B5 wave |
| ------------------------------------ | ------: | ------- |
| `@osva-ai/connector-amplitude`       |   0.1.0 |         |
| `@osva-ai/connector-aws-s3`          |   0.1.1 | Yes     |
| `@osva-ai/connector-azure-blob`      |   0.1.1 | Yes     |
| `@osva-ai/connector-bigcommerce`     |   0.1.0 |         |
| `@osva-ai/connector-bigquery`        |   0.1.1 | Yes     |
| `@osva-ai/connector-confluence`      |   0.1.0 |         |
| `@osva-ai/connector-exa`             |   0.1.0 |         |
| `@osva-ai/connector-firecrawl`       |   0.1.1 | Yes     |
| `@osva-ai/connector-freshdesk`       |   0.1.1 | Yes     |
| `@osva-ai/connector-ga4`             |   0.1.1 |         |
| `@osva-ai/connector-gcs`             |   0.1.1 | Yes     |
| `@osva-ai/connector-github`          |   0.4.0 | Yes     |
| `@osva-ai/connector-gmail`           |   0.1.0 |         |
| `@osva-ai/connector-google-ads`      |   0.1.1 | Yes     |
| `@osva-ai/connector-google-calendar` |   0.1.0 |         |
| `@osva-ai/connector-google-drive`    |   0.1.0 |         |
| `@osva-ai/connector-google-sheets`   |   0.1.0 |         |
| `@osva-ai/connector-gsc`             |   0.1.0 |         |
| `@osva-ai/connector-hubspot`         |   0.1.0 |         |
| `@osva-ai/connector-intercom`        |   0.1.1 | Yes     |
| `@osva-ai/connector-jira`            |   0.1.1 | Yes     |
| `@osva-ai/connector-linear`          |   0.1.1 | Yes     |
| `@osva-ai/connector-meta-ads`        |   0.1.0 |         |
| `@osva-ai/connector-mixpanel`        |   0.1.0 |         |
| `@osva-ai/connector-notion`          |   0.1.1 | Yes     |
| `@osva-ai/connector-npm`             |   0.1.1 |         |
| `@osva-ai/connector-onedrive`        |   0.1.1 | Yes     |
| `@osva-ai/connector-outlook`         |   0.1.1 | Yes     |
| `@osva-ai/connector-pinecone`        |   0.1.1 | Yes     |
| `@osva-ai/connector-pipedrive`       |   0.1.0 |         |
| `@osva-ai/connector-postgres`        |   0.1.1 |         |
| `@osva-ai/connector-qdrant`          |   0.1.1 | Yes     |
| `@osva-ai/connector-salesforce`      |   0.1.0 |         |
| `@osva-ai/connector-shopify`         |   0.1.1 |         |
| `@osva-ai/connector-slack`           |   0.1.0 |         |
| `@osva-ai/connector-snowflake`       |   0.1.1 | Yes     |
| `@osva-ai/connector-stripe`          |   0.1.0 |         |
| `@osva-ai/connector-supabase`        |   0.1.1 | Yes     |
| `@osva-ai/connector-tavily`          |   0.1.0 |         |
| `@osva-ai/connector-teams`           |   0.1.0 |         |
| `@osva-ai/connector-whatsapp`        |   0.1.0 |         |
| `@osva-ai/connector-woocommerce`     |   0.1.0 |         |
| `@osva-ai/connector-zendesk`         |   0.1.0 |         |
| `@osva-ai/connector-zoho-crm`        |   0.1.0 |         |

Machine-readable: `docs/connector-catalog.json` (regenerate with `pnpm generate:connector-catalog` when versions change).

---

## 5. Published artifact acceptance (Windows)

| Field                              | Value                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Command                            | `node scripts/release/published-package-acceptance.mjs --all-connectors --concurrency=1` |
| Exit code                          | **0**                                                                                    |
| Duration                           | ~26.4 min                                                                                |
| Report                             | `audit-results/published-acceptance/b5-6a-windows-full.json` (local)                     |
| Packages passed / failed / skipped | **45 / 0 / 0**                                                                           |
| Individual checks skipped          | **36** (see §8)                                                                          |

All 45 packages: overall **PASSED** (no required check failures).

---

## 6. Provenance (OIDC / B5 wave)

| Scope                              | Packages | Result                                                                                                                                              |
| ---------------------------------- | -------: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| B5 wave (mandatory provenance)     |       18 | **PASSED** — `signatures-present` on registry metadata for each                                                                                     |
| Non-wave (provenance not mandated) |       27 | **PASSED** — registry also reports `signatures-present` for tested versions (informational; wave flag still controls fail-closed policy in harness) |

No wave package reported missing provenance as PASSED.

---

## 7. Dist-tag consistency

| Scope        | Result                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| B5 wave (18) | **PASSED** — `latest` matches workspace version                                            |
| Legacy (27)  | **SKIPPED** — dist-tag assertion disabled unless `--expect-latest` (27× `dist_tag_latest`) |

Operator follow-up (optional): re-run with `--expect-latest` after confirming all 27 legacy packages should pin `latest` to repo versions.

---

## 8. MCP smoke & other skipped checks

| Check             | Count | Reason                                                                                                                               |
| ----------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------ |
| `dist_tag_latest` |    27 | Not requested for non-wave packages                                                                                                  |
| `cli_probe`       |     8 | CLI exited 0 without credentials (documented skip — not fail-fast)                                                                   |
| `mcp_smoke`       |     1 | `@osva-ai/connector-postgres` — `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` unset (published smoke requires integration URL by design) |

No provider credentials were used. No live provider HTTP.

---

## 9. Windows execution environment

| Item              | Value                                  |
| ----------------- | -------------------------------------- |
| OS                | Windows 10.0.26200                     |
| Node              | v24.13.1                               |
| pnpm              | 12.4.1                                 |
| Platform (report) | `win32`                                |
| npm cache         | Ephemeral temp dir (removed after run) |

---

## 10. Linux execution status

| Item                                     | Status                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| CI `ci.yml` packaged acceptance          | **SKIPPED for B5.6A gate** — builds from **monorepo source/tarballs**, not registry installs                       |
| `published-package-acceptance-linux.yml` | **ADDED** — `workflow_dispatch`, Node 24, `ubuntu-24.04`, `permissions: contents: read`, uploads JSON/MD artifacts |
| Linux matrix execution                   | **NOT_RUN** — only a human operator may dispatch the workflow                                                      |

---

## 11. Release workflow integrity

| Command                       | Result                            |
| ----------------------------- | --------------------------------- |
| `pnpm test:release-workflows` | **PASSED** — 43/43 tests (exit 0) |

Verified properties (via existing tests): 45 workflows map 1:1 to packages; `workflow_dispatch` only; OIDC default (`id-token: write`); publish gates (`dry_run`, `confirm_publish`); no accidental token path; `expected_version` defaults match workspace; acceptance command + checklist alignment; main-only publish guard; npm 11.5.1+ guard.

**Not performed:** workflow dispatch, npm publish, trusted-publisher changes.

---

## 12. B5.5 live-provider integration (harness health)

| Command                                                   | Result                                           |
| --------------------------------------------------------- | ------------------------------------------------ |
| `pnpm test:live-provider-acceptance`                      | **PASSED** — 20/20                               |
| `pnpm test:live-provider-acceptance:matrix`               | **PASSED** — 45-row matrix                       |
| `pnpm test:live-provider-acceptance:pilot`                | **PASSED** — `live=false`, executed=3, blocked=3 |
| `node scripts/live-provider/mutation-inventory-audit.mjs` | **PASSED** — exit 0                              |

Confirmed: default live execution **disabled**; pilot/live_read **BLOCKED** without credentials; mock/preflight results are not live PASS.

**Live-provider operational readiness:** **NOT_RUN** (post B5.6A operator waves).

---

## 13. Engineering verification (B5.6A session)

| Command                                     | Exit | Notes                                  |
| ------------------------------------------- | ---: | -------------------------------------- |
| `pnpm test:release-workflows`               |    0 | 43 tests                               |
| `pnpm test:published-package-acceptance`    |    0 | 14 tests                               |
| `pnpm test:live-provider-acceptance`        |    0 | 20 tests                               |
| `pnpm test:live-provider-acceptance:matrix` |    0 | 45 connectors                          |
| `pnpm test:live-provider-acceptance:pilot`  |    0 | preflight only                         |
| `pnpm format:check`                         |    0 | after Prettier on new scripts/workflow |
| `git diff --check`                          |    0 |                                        |
| Full `--all-connectors` published matrix    |    0 | 45/45 packages (§5)                    |

---

## 14. Known security limitations & operator follow-up

1. **Linux:** Dispatch `Published package acceptance (Linux)` once before claiming cross-platform published readiness.
2. **Postgres published MCP smoke:** Set `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` (sandbox) or accept documented skip for registry-only gate.
3. **Legacy dist-tags:** Run `--expect-latest` when policy requires all 45 `latest` tags to match repo.
4. **Live-provider:** Authorized sandbox execution remains **B5.6B / post-merge** (credentials + `OSVA_LIVE_PROVIDER_EXECUTE=1`).
5. **Evidence artifacts:** Keep `audit-results/` local (now in `.gitignore`); attach CI/Linux artifacts to release record when available.
6. **CLI probe skips (8):** Connectors that exit 0 without credentials do not prove fail-fast; tracked as **SKIPPED**, not **PASSED** security property.

---

## 15. Release gate classification

### Published artifact readiness

**PASSED** — Windows full matrix: all 45 exact versions on npm, install + checks pass.

### Cross-platform readiness

| Platform                         | Status      |
| -------------------------------- | ----------- |
| Windows published npm acceptance | **PASSED**  |
| Linux published npm acceptance   | **NOT_RUN** |

### Live-provider operational readiness

**NOT_RUN** / **BLOCKED** — harness healthy; no authorized live provider execution in B5.6A.

---

## 16. Files changed (B5.6A implementation)

| File                                                       | Change                                    |
| ---------------------------------------------------------- | ----------------------------------------- |
| `docs/release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md`     | Evidence closeout (this document)         |
| `.github/workflows/published-package-acceptance-linux.yml` | Manual Linux registry acceptance          |
| `scripts/release/summarize-published-verification.mjs`     | JSON report summary helper                |
| `package.json`                                             | `summarize:published-verification` script |
| `.gitignore`                                               | Ignore `audit-results/`                   |

---

## 17. B5.6B prerequisites

1. Successful **Linux** `workflow_dispatch` published acceptance (artifact retained).
2. Operator decision on **postgres** published smoke (integration URL vs documented exception).
3. Optional **`--expect-latest`** full-matrix run for legacy dist-tags.
4. Live-provider **pilot + wave** execution with sandbox credentials and mutation approvals.
5. Human commit/PR on `feat/b5-6-release-closeout` (agents do not commit).

---

## 18. Final verification decision

**READY_FOR_B5_6A_LOCAL_COMMIT**

This verdict means B5.6A implementation and scoped Windows/npm evidence are ready for human review and local commit. It does **not** imply Linux published acceptance or live-provider operational acceptance passed.
