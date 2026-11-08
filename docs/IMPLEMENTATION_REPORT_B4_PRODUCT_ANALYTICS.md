# Implementation report — B4.4 Product analytics (`feat/b4-product-analytics`)

## Summary

Two new publishable packages under OSVA Connector Profile V1:

- [`@osva-ai/connector-mixpanel`](../packages/mixpanel) — **6** read-only MCP tools (Mixpanel Query API).
- [`@osva-ai/connector-amplitude`](../packages/amplitude) — **7** read-only MCP tools (Amplitude Dashboard REST).

Repository connector count: **29 → 31**. Prior **22** npm publications unchanged (these packages are **source-only** until release). Both pin **`@osva-ai/connector-sdk@1.1.4`**, target **Node 24+** / **pnpm 12.4.1**, and follow GA4/GSC patterns (thin REST, Zod + JSON Schema, bounded HTTP, credential redaction, stdio binaries, mock HTTP fixtures, package acceptance, manual OIDC release workflows).

**Not committed, not published, not pushed** (per task).

## Phase 1 — Build vs reuse

| Provider      | Official alternative                                                            | Decision                    | Rationale                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mixpanel**  | [Mixpanel MCP](https://docs.mixpanel.com/docs/mcp) (hosted)                     | Thin Query API adapter      | Stable OSVA tool names; stdio installable binary; fixed region hosts; service-account scope; query/output caps; no dependence on remote tool catalog churn; no JQL/export surfaces. |
| **Amplitude** | [Amplitude MCP](https://amplitude.com/docs/amplitude-ai/amplitude-mcp) (hosted) | Thin Dashboard REST adapter | Same isolation and budget controls; explicit chart allowlist; omits high-privacy user search/activity endpoints; predictable JSON for agents.                                       |

Neither official MCP server is wrapped. We do **not** reimplement analytics engines or mirror full hosted tool catalogs.

### Change-impact inventory

| Area              | Impact                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Packages (new)    | `packages/mixpanel/**`, `packages/amplitude/**`                                                                        |
| Workspace scripts | `scripts/connector-packages.mjs`, `package-acceptance-{mixpanel,amplitude}*.mjs`, `package-acceptance-npm-dry-run.mjs` |
| CI release        | `.github/workflows/npm-release-{mixpanel,amplitude}.yml`                                                               |
| Docs              | `INSTALL-*`, `RELEASE-CHECKLIST-*`, `compatibility.md`, `README.md`, this report                                       |
| Prior connectors  | No source changes to existing packages (integration-only diff)                                                         |

## Selected API endpoints

### Mixpanel Query API (Basic service account)

| Region host                           | Tools         |
| ------------------------------------- | ------------- |
| `https://mixpanel.com/api/query` (US) | All six tools |
| `https://eu.mixpanel.com/api/query`   | Same paths    |
| `https://in.mixpanel.com/api/query`   | Same paths    |

| MCP tool                    | HTTP                                                      |
| --------------------------- | --------------------------------------------------------- |
| `mixpanel.report.get`       | `GET /insights?bookmark_id=`                              |
| `mixpanel.segmentation.run` | `GET /segmentation` (legacy; documented maintenance mode) |
| `mixpanel.funnel.get`       | `GET /funnels?funnel_id=` (saved funnel)                  |
| `mixpanel.retention.run`    | `GET /retention` (ad-hoc born/return events)              |
| `mixpanel.cohort.list`      | `POST /cohorts/list`                                      |
| `mixpanel.event.top`        | `GET /events/top`                                         |

**Out of scope:** JQL, Raw Export, Engage/profile query, ingestion, project token as Query auth.

### Amplitude Dashboard REST (Basic `api_key:secret_key`)

| Region | Base                                 |
| ------ | ------------------------------------ |
| US     | `https://amplitude.com`              |
| EU     | `https://analytics.eu.amplitude.com` |

| MCP tool                       | HTTP                                                   |
| ------------------------------ | ------------------------------------------------------ |
| `amplitude.event.list`         | `GET /api/2/events/list`                               |
| `amplitude.event.segmentation` | `GET /api/2/events/segmentation`                       |
| `amplitude.funnel.run`         | `GET /api/2/funnels`                                   |
| `amplitude.retention.run`      | `GET /api/2/retention`                                 |
| `amplitude.user.active`        | `GET /api/2/users` (aggregate series; not user search) |
| `amplitude.chart.get`          | `GET /api/3/chart/{id}/query`                          |
| `amplitude.session.average`    | `GET /api/2/sessions/average`                          |

**Out of scope:** User Activity / User Search, Export API, ingestion, taxonomy admin.

## Auth and residency

| Package   | Configuration                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mixpanel  | `OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_USERNAME`, `OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_SECRET`, `OSVA_CONNECTOR_MIXPANEL_PROJECT_ID`, `OSVA_CONNECTOR_MIXPANEL_REGION` (`us`/`eu`/`in`), optional `OSVA_CONNECTOR_MIXPANEL_WORKSPACE_ID` |
| Amplitude | `OSVA_CONNECTOR_AMPLITUDE_API_KEY`, `OSVA_CONNECTOR_AMPLITUDE_SECRET_KEY`, `OSVA_CONNECTOR_AMPLITUDE_REGION` (`us`/`eu`)                                                                                                                       |

Agents cannot override project, region, or API hosts via tool input.

## Project isolation

- All requests include the configured **project ID** (Mixpanel query param) or Amplitude credentials scoped to one project.
- Optional **bookmark / funnel / chart** allowlists (tri-state: unset, empty deny-all, comma-separated).
- Saved report/chart IDs are not cryptographically bound to project in all provider responses; **provider ACLs remain authoritative** when APIs omit owning-project metadata.
- Cross-project access attempts surface as provider **401/403/404**; connector maps without leaking secrets.

## Query and cost restrictions

| Control             | Mixpanel                                      | Amplitude                       |
| ------------------- | --------------------------------------------- | ------------------------------- |
| Max lookback        | 90 days (segmentation/retention/funnel dates) | 90 days (`YYYYMMDD`)            |
| Max funnel steps    | N/A (saved funnel id)                         | 5 events                        |
| Max group-by        | Segmentation `limit` capped                   | 2 properties                    |
| Max expression size | `where`/`on` length + no newlines             | Event JSON + segment param caps |
| HTTP response       | 2 MiB read cap                                | 2 MiB read cap                  |
| MCP output          | 256 KiB structured JSON                       | 256 KiB + `providerCalculated`  |
| Retries             | One retry on 429/5xx + `Retry-After`          | Same                            |

Local caps **do not** guarantee account-level query budgets; provider rate/cost limits still apply.

## Correctness limitations

- Mixpanel **segmentation** and **legacy funnel query** APIs are in maintenance mode; Insights saved reports are preferred for parity with the UI.
- Mixpanel **retention** semantics (`birth` vs `compounded`, interval buckets) are passed through normalized with provider labels.
- Amplitude **funnel mode**, **retention type** (`rm`), and **session** definitions are provider-calculated; connector does not recompute conversion.
- Mixpanel vs Amplitude differ on identity, sessions, funnels, retention, and time zones — outputs preserve source-specific fields where needed.

## Tests and verification (this task)

| Package   | Vitest files | Tests |
| --------- | ------------ | ----- |
| Mixpanel  | 10           | 33    |
| Amplitude | 13           | 36    |

**Closeout API fixes:** (1) `mixpanel.funnel.get` now requires `fromDate`/`toDate` per Query API `GET /funnels`. (2) `mixpanel.cohort.list` no longer sends unsupported `limit` on `POST /cohorts/list`; limit applied locally with truncation metadata.

Commands run successfully:

```bash
pnpm format
pnpm format:check
pnpm --filter @osva-ai/connector-mixpanel lint && pnpm --filter @osva-ai/connector-mixpanel typecheck
pnpm --filter @osva-ai/connector-amplitude lint && pnpm --filter @osva-ai/connector-amplitude typecheck
pnpm --filter @osva-ai/connector-mixpanel test
pnpm --filter @osva-ai/connector-amplitude test
pnpm --filter @osva-ai/connector-mixpanel build
pnpm --filter @osva-ai/connector-amplitude build
pnpm test:package-acceptance:mixpanel
pnpm test:package-acceptance:amplitude
pnpm verify:boundaries
git diff --check
```

## Packaged MCP acceptance

- **Mixpanel:** tarball `osva-ai-connector-mixpanel-0.1.0.tgz`, isolated install, `tools/list` smoke — **passed**
- **Amplitude:** tarball `osva-ai-connector-amplitude-0.1.0.tgz`, isolated install, `tools/list` smoke — **passed**

## Deferred validation

- Live Mixpanel/Amplitude credentials against production projects (CI uses hermetic mocks only).
- npm bootstrap and Trusted Publisher configuration for the two new package names.

## npm publication readiness

Packages build, test, and pass acceptance scripts. Release workflows: `npm-release-mixpanel.yml`, `npm-release-amplitude.yml` (`workflow_dispatch`, `dry_run` default **true**).

## Recommended PR metadata

**Title:** `feat(connectors): Mixpanel and Amplitude product analytics MCP (B4.4)`

**Commit message:**

```
Add read-only Mixpanel and Amplitude MCP connectors with bounded Query/Dashboard REST adapters.

Introduces @osva-ai/connector-mixpanel (6 tools) and @osva-ai/connector-amplitude (7 tools),
stdio binaries, mock-provider tests, package acceptance, install/release docs, and manual npm workflows.
Repository connector count 29 → 31; existing 22 npm publications unchanged.
```

## Files changed (high level)

- New: `packages/mixpanel/**`, `packages/amplitude/**`
- New: `docs/INSTALL-MIXPANEL.md`, `docs/INSTALL-AMPLITUDE.md`, `docs/RELEASE-CHECKLIST-*.md`, this report
- New: `.github/workflows/npm-release-mixpanel.yml`, `npm-release-amplitude.yml`
- New: `scripts/package-acceptance-mixpanel*`, `package-acceptance-amplitude*`
- Modified: `package.json`, `pnpm-lock.yaml`, `scripts/connector-packages.mjs`, `scripts/package-acceptance-npm-dry-run.mjs`, `README.md`, `docs/compatibility.md`
