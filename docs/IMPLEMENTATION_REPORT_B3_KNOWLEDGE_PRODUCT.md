# Implementation report — B3.2 Knowledge product (`feat/b3-knowledge-product`)

## Summary

Two new publishable packages under OSVA Connector Profile V1:

- [`@osva-ai/connector-notion`](../packages/notion) — **9** MCP tools (6 read, 3 gated mutations).
- [`@osva-ai/connector-linear`](../packages/linear) — **10** MCP tools (7 read, 3 gated mutations).

Both pin **`@osva-ai/connector-sdk@1.1.4`**, use strict Zod + parallel JSON Schema tool inputs, bounded HTTP/GraphQL transports, credential redaction, stdio entrypoints, package acceptance scripts, and manual npm release workflows.

## Phase 1 — Build vs reuse

| Provider   | Decision                                                                     | Rationale                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Notion** | **Thin native REST adapter** (no `@notionhq/client`, no official Notion MCP) | Full control over `Notion-Version` (**`2026-03-11`** default), **database vs data source** routing, bounded bodies, host URL allowlisting, OSVA tool contracts, and packaged stdio. Official SDK would add version coupling and still need OSVA output/security layers. |
| **Linear** | **Thin native GraphQL adapter** (no `@linear/sdk`, no Linear remote MCP)     | Stable, fixed operations per tool (no arbitrary GraphQL tool), dual auth header rules, partial-error handling, bounded pagination, and testable mock GraphQL server. Remote MCP does not provide OSVA mutation gates or output budgets.                                 |

## Architecture

- **Notion:** `createNotionRestClient` → `api.notion.com` with `Notion-Version`; read retries capped; mutations without connector retries.
- **Linear:** `createLinearGraphqlClient` → `api.linear.app/graphql`; predefined query/mutation documents only.

### Authentication

- **Notion:** `OSVA_CONNECTOR_NOTION_ACCESS_TOKEN` (integration secret only via env).
- **Linear:** `OSVA_CONNECTOR_LINEAR_API_KEY` (raw `Authorization`) and/or `OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN` (`Bearer`).

### Read/write boundaries

| Connector | Default   | Mutations require                                                                                                                 |
| --------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Notion    | Read-only | `OSVA_CONNECTOR_NOTION_WRITE_ENABLED` + `OSVA_CONNECTOR_NOTION_HOST_WRITES_APPROVED`                                              |
| Linear    | Read-only | `OSVA_CONNECTOR_LINEAR_WRITE_ENABLED` + `OSVA_CONNECTOR_LINEAR_HOST_MUTATIONS_APPROVED` (+ optional team allowlist for mutations) |

Host approval and write flags are **never** tool input fields.

## Shared code

No new shared monorepo package. Patterns copied from `packages/hubspot`, `packages/slack`, and B3.1 Gmail/Calendar (bounded fetch, `map*Error`, `packListWithinOutputBudget`, acceptance smoke).

## Files changed / added (high level)

- `packages/notion/**` (new)
- `packages/linear/**` (new)
- `scripts/connector-packages.mjs`, `scripts/package-acceptance-{notion,linear}*.mjs`, `scripts/package-acceptance-npm-dry-run.mjs`
- `.github/workflows/npm-release-{notion,linear}.yml`
- `docs/INSTALL-{NOTION,LINEAR}.md`, `docs/RELEASE-CHECKLIST-{NOTION,LINEAR}.md`
- `docs/compatibility.md`, `README.md`
- Root `package.json` (workspace filters + acceptance scripts)

## Verification (executed)

| Step       | Command                                                                                | Result                     |
| ---------- | -------------------------------------------------------------------------------------- | -------------------------- |
| Prettier   | `pnpm exec prettier --write packages/notion packages/linear …`                         | OK                         |
| Lint       | `pnpm --filter @osva-ai/connector-notion --filter @osva-ai/connector-linear lint`      | OK (after `rich-text` fix) |
| Typecheck  | `pnpm --filter @osva-ai/connector-notion --filter @osva-ai/connector-linear typecheck` | OK                         |
| Unit tests | `pnpm --filter @osva-ai/connector-notion test`                                         | **13** tests               |
| Unit tests | `pnpm --filter @osva-ai/connector-linear test`                                         | **23** tests               |
| Build      | `pnpm --filter @osva-ai/connector-notion --filter @osva-ai/connector-linear build`     | OK                         |
| Acceptance | `node scripts/package-acceptance-notion.mjs`                                           | OK (MCP smoke passed)      |
| Acceptance | `node scripts/package-acceptance-linear.mjs`                                           | OK (MCP smoke passed)      |
| Boundaries | `pnpm verify:boundaries`                                                               | OK                         |
| Whitespace | `git diff --check`                                                                     | OK                         |

**Deferred:** Live Notion/Linear production API calls (no real credentials in CI).

## Final audit fixes (B3.2 review)

| Area                  | Defect                                 | Fix                                                                                          |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Notion `2026-03-11`   | Page update sent deprecated `archived` | Tool + REST client use `inTrash` → `in_trash` (legacy `2025-09-03` still maps to `archived`) |
| Notion `2026-03-11`   | Block append omitted `position`        | Optional `position` (`end` / `start` / `after_block`); no legacy `after` tool input          |
| Notion normalize      | `meeting_notes` not handled            | Rich-text/title normalization; legacy `transcription` tagged                                 |
| Notion normalize      | Response `archived` only               | Normalized `inTrash` from `in_trash` or `archived`                                           |
| Linear mutations      | `success: false` ignored               | Explicit failure when mutation payload reports `success === false`                           |
| Linear team allowlist | `issue.list` without `teamId` bypass   | Require `teamId` when allowlist configured; filter search results; verify on `issue.get`     |

Regression tests: `notion-api-version-regression.test.ts`, `linear-graphql-regression.test.ts`, team allowlist case in `connector-fake-provider.test.ts`.

## Known limitations (v0.1.0)

- Notion: no file uploads, no workspace-parent page create, shallow nested block normalization (depth env cap), rich-text extraction only (no full block renderer).
- Linear: no OAuth login server; mutation validators cover team/project/state/priority identifiers supported by fixed GraphQL operations; no arbitrary GraphQL tool.

## npm publication readiness

Packages at **`0.1.0`**, acceptance + release workflows present; **not published** (no commit/push/publish in this task).

## Recommended commit message

```
feat(connectors): add Notion and Linear MCP packages (B3.2)

Introduce @osva-ai/connector-notion and @osva-ai/connector-linear with
Profile V1 stdio tools, bounded provider adapters, host-gated mutations,
acceptance scripts, and release workflows.
```

## Recommended PR title

**B3.2: Notion + Linear MCP connectors (knowledge product)**
