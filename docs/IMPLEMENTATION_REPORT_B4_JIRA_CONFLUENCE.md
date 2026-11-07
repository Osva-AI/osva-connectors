# Implementation report — B4.1 Jira + Confluence (`feat/b4-jira-confluence`)

## Summary

Two new publishable packages under OSVA Connector Profile V1:

- [`@osva-ai/connector-jira`](../packages/jira) — **9** MCP tools (5 read, 4 gated mutations).
- [`@osva-ai/connector-confluence`](../packages/confluence) — **8** MCP tools (6 read, 2 gated mutations).

Repository connector count: **22 → 24**. Both packages pin **`@osva-ai/connector-sdk@1.1.4`**, target **Node 24+** / **pnpm 12.4.1**, and follow B3 patterns (Zod + JSON Schema, bounded REST transports, credential redaction, stdio binaries, hermetic fake-provider tests, package acceptance, manual OIDC release workflows).

**Not committed, not published, not pushed** (per task).

## Phase 1 — Build vs reuse (Atlassian Rovo MCP)

| Option                                                                                                         | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/)** (`https://mcp.atlassian.com/v2/mcp`) | Suitable when hosts already run MCP clients with **OAuth 2.1** (or Atlassian headless API token), want the **full evolving tool catalog** (Jira, Confluence, Bitbucket, Loom, Teamwork Graph, semantic Rovo search), and accept **Rovo credit** consumption and **remote server** coupling.                                                                                                                                                                                                                                      |
| **Native `@osva-ai/connector-jira` + `@osva-ai/connector-confluence`**                                         | **Implemented** — justified for OSVA deployments that need: **standalone npm stdio** binaries; **narrow, stable** dot-tool contracts; **independent** Jira vs Confluence host configuration; **direct REST** normalization (ADF, storage format, issue keys, source URLs); **tri-state project/space allowlists** and **JQL/CQL scoping**; **default-disabled mutations** with **dual host write gates**; **bounded** pagination/output; **no Rovo credits**; compatibility with existing connector release/acceptance patterns. |

**Decision:** Implement **focused native REST connectors**; do **not** mirror Rovo’s full catalog. Hosts needing Teamwork Graph, Loom, or broad discover-on-demand tools should configure Rovo MCP separately alongside these packages when appropriate.

### Change-impact inventory (concise)

| Area              | Impact                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| New packages      | `packages/jira/**`, `packages/confluence/**`                                                                        |
| Workspace scripts | `scripts/connector-packages.mjs`, `package-acceptance-{jira,confluence}*.mjs`, `package-acceptance-npm-dry-run.mjs` |
| CI release        | `.github/workflows/npm-release-{jira,confluence}.yml`                                                               |
| Docs              | `INSTALL-*`, `RELEASE-CHECKLIST-*`, `compatibility.md`, `README.md`, this report                                    |
| Lockfile          | `pnpm-lock.yaml` (two new workspace packages)                                                                       |
| Prior connectors  | **No source changes** to existing 22 packages                                                                       |

## Tool inventory

### Jira (`@osva-ai/connector-jira`)

| Tool                          | Mode             |
| ----------------------------- | ---------------- |
| `jira.project.list`           | Read             |
| `jira.project.get`            | Read             |
| `jira.issue.search`           | Read             |
| `jira.issue.get`              | Read             |
| `jira.issue.transitions.list` | Read             |
| `jira.issue.create`           | Mutating (gated) |
| `jira.issue.update`           | Mutating (gated) |
| `jira.issue.comment.create`   | Mutating (gated) |
| `jira.issue.transition`       | Mutating (gated) |

### Confluence (`@osva-ai/connector-confluence`)

| Tool                            | Mode             |
| ------------------------------- | ---------------- |
| `confluence.space.list`         | Read             |
| `confluence.space.get`          | Read             |
| `confluence.page.list`          | Read             |
| `confluence.page.get`           | Read             |
| `confluence.search`             | Read             |
| `confluence.page.children.list` | Read             |
| `confluence.page.create`        | Mutating (gated) |
| `confluence.page.update`        | Mutating (gated) |

## Authentication

| Mode              | Jira                                                                                    | Confluence                                                       |
| ----------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Site Basic**    | `SITE_URL` + `EMAIL` + `API_TOKEN` → `{site}/rest/api/3/`                               | Same → `{site}/wiki/api/v2/` (+ CQL on `wiki/rest/api/search`)   |
| **Site Bearer**   | `SITE_URL` + `ACCESS_TOKEN`                                                             | Same                                                             |
| **OAuth gateway** | `CLOUD_ID` + `ACCESS_TOKEN` → `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/` | `https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2/` |

Startup validation rejects mixed/invalid auth. **No** OAuth consent server; **no** refresh token persistence; **no** tokens in tool inputs; **no** agent-controlled `cloudId`/site changes.

**OAuth scopes (documented for hosts):** Jira — `read:jira-work`, `write:jira-work` (mutations); Confluence — `read:confluence-content.all`, `write:confluence-content` (mutations). Exact scope sets depend on host IdP registration.

## API versions and endpoints

| Product    | API                        | Notes                                                                                                                     |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Jira       | REST **v3**                | Issue search via **`POST /rest/api/3/search/jql`** with **`nextPageToken`**; legacy **`GET /rest/api/3/search`** not used |
| Confluence | REST **v2** (spaces/pages) | Cursor pagination via `_links.next` (host-validated only)                                                                 |
| Confluence | **CQL** search             | `wiki/rest/api/search` on configured host                                                                                 |

## Tenant isolation and authorization

| Mechanism      | Jira                                                                                                                       | Confluence                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Allowlist env  | `OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS`                                                                                 | `OSVA_CONNECTOR_CONFLUENCE_ALLOWED_SPACE_IDS` |
| Tri-state      | Unset = unrestricted by connector policy; `""` = deny-all; list = restrict                                                 | Same                                          |
| Search scoping | JQL wrapped `AND project in (...)`; rejects `project not in` / foreign keys                                                | CQL space constraints when allowlist set      |
| Mutations      | Require `WRITE_ENABLED` + `HOST_WRITES_APPROVED`; allowlist present must be **non-empty**; target project/space must match | Same pattern                                  |
| Pagination     | Fixed API hosts only; no arbitrary external URL following                                                                  | `next` links validated against allowed origin |

## Files added / changed (high level)

- **New:** `packages/jira/**` (16 `src/`, 9 `test/`, README, LICENSE, package.json, tsconfigs)
- **New:** `packages/confluence/**` (16 `src/`, 9 `test/`, README, LICENSE, package.json, tsconfigs)
- **Updated:** `scripts/connector-packages.mjs`, root `package.json`, `pnpm-lock.yaml`
- **New:** `scripts/package-acceptance-{jira,confluence}.mjs`, `*-smoke.mjs`
- **Updated:** `scripts/package-acceptance-npm-dry-run.mjs`
- **New:** `.github/workflows/npm-release-{jira,confluence}.yml`
- **New:** `docs/INSTALL-{JIRA,CONFLUENCE}.md`, `docs/RELEASE-CHECKLIST-{JIRA,CONFLUENCE}.md`
- **Updated:** `docs/compatibility.md`, `README.md`

## Testing

| Package    | Test files | Tests  |
| ---------- | ---------- | ------ |
| Jira       | 7          | **20** |
| Confluence | 7          | **19** |

Hermetic mock HTTP servers cover: Basic/OAuth/gateway routing, JQL `nextPageToken`, legacy search path rejection (Jira), allowlist bypass attempts, ADF normalization, mutation gates, transition validation, Confluence version conflicts (409), pagination URL validation, credential redaction, MCP `tools/list` + `tools/call`.

## Verification (executed locally)

| Step                                               | Result                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| Prettier (changed files + lockfile)                | OK                                                                         |
| `pnpm format:check`                                | OK                                                                         |
| Lint + typecheck (jira, confluence)                | OK                                                                         |
| `pnpm --filter @osva-ai/connector-jira test`       | **20** passed                                                              |
| `pnpm --filter @osva-ai/connector-confluence test` | **19** passed                                                              |
| Production build (both)                            | OK                                                                         |
| `pnpm test:package-acceptance:jira`                | OK (MCP smoke)                                                             |
| `pnpm test:package-acceptance:confluence`          | OK (MCP smoke)                                                             |
| `pnpm verify:boundaries`                           | OK                                                                         |
| `git diff --check`                                 | OK                                                                         |
| Workflow YAML                                      | Cloned from verified `npm-release-linear.yml` template (structural parity) |

**Deferred:** Live Jira/Confluence Cloud calls with real tenant credentials (none in CI).

## Known limitations (v1)

- No arbitrary REST/GraphQL execution tools.
- No attachment uploads, permission administration, or unrestricted content deletion (Confluence).
- No connector-level OAuth refresh or multi-tenant switching.
- Jira workflow metadata discovered per operation; no generic field editor beyond validated create/update/comment/transition paths.
- Rovo semantic search and Teamwork Graph not duplicated.

## npm publication readiness

- Packages build, test, and pass packaged MCP acceptance.
- Release workflows and checklists are in place (`dry_run` default **true**).
- **Status:** **Source-only** `@0.1.0` until manual workflow publish after PR merge.

## Recommended PR

**Title:** `feat(connectors): add Jira and Confluence Cloud MCP packages (B4.1)`

**Commit message:**

```
feat(connectors): add Jira and Confluence Cloud packages (B4.1)

Introduce @osva-ai/connector-jira and @osva-ai/connector-confluence with
bounded REST adapters, tri-state allowlists, gated mutations, acceptance
tests, and release workflows—expanding the monorepo to 24 connectors.
```
