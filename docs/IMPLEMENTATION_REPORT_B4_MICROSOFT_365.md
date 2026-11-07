# Implementation report — B4.2 Microsoft 365 (`feat/b4-microsoft-365`)

## Summary

Three new publishable packages under OSVA Connector Profile V1:

- [`@osva-ai/connector-outlook`](../packages/outlook) — **9** MCP tools (7 read, 2 gated mutations).
- [`@osva-ai/connector-onedrive`](../packages/onedrive) — **6** MCP tools (5 read, 1 gated mutation).
- [`@osva-ai/connector-teams`](../packages/teams) — **8** MCP tools (6 read, 2 gated mutations).

Repository connector count: **24 → 27**. All three packages pin **`@osva-ai/connector-sdk@1.1.4`**, target **Node 24+** / **pnpm 12.4.1**, and follow B3/B4 patterns (Zod + JSON Schema, bounded Graph REST transports, credential redaction, stdio binaries, hermetic mock HTTP servers, package acceptance, manual OIDC release workflows).

**Not committed, not published, not pushed** (per task).

## Phase 10 — Build vs reuse (Microsoft Work IQ MCP)

| Option                                                                                                                         | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[Microsoft Work IQ MCP](https://learn.microsoft.com/en-us/microsoft-cloud/mcp)** (and related Microsoft-hosted MCP surfaces) | Appropriate when hosts already operate inside Microsoft 365 Copilot / Entra-integrated MCP clients, want **broad, evolving** Microsoft 365 tool catalogs (including semantic search and agent orchestration owned by Microsoft), and accept **remote MCP server** coupling, Microsoft tenancy policy, and product-specific consent models.                                                                                                                                                                                                                 |
| **Native `@osva-ai/connector-outlook` + `@osva-ai/connector-onedrive` + `@osva-ai/connector-teams`**                           | **Implemented (repository integration)** — justified for OSVA deployments that need: **standalone npm stdio** binaries; **narrow, stable** dot-tool contracts per workload; **delegated-user-only** Graph access aligned with host-injected tokens; **independent** Outlook vs OneDrive vs Teams host configuration; **tri-state allowlists** and **dual host write/send gates**; **bounded** pagination and output; **no dependency** on Microsoft-hosted MCP uptime or catalog churn; compatibility with existing connector release/acceptance patterns. |

**Decision:** Implement **focused native Graph v1.0 connectors** (delegated `/me` and related fixed paths); do **not** wrap Microsoft Work IQ MCP as the primary transport. Hosts needing full-fidelity Copilot / Work IQ discovery should configure Microsoft MCP alongside these packages when appropriate.

### Change-impact inventory (repository integration)

| Area                           | Impact                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Packages (pre-existing source) | `packages/outlook/**`, `packages/onedrive/**`, `packages/teams/**`                                                         |
| Workspace scripts              | `scripts/connector-packages.mjs`, `package-acceptance-{outlook,onedrive,teams}*.mjs`, `package-acceptance-npm-dry-run.mjs` |
| CI release                     | `.github/workflows/npm-release-{outlook,onedrive,teams}.yml`                                                               |
| Docs                           | `INSTALL-*`, `RELEASE-CHECKLIST-*`, `compatibility.md`, `README.md`, this report                                           |
| Prior connectors               | **No source changes** to existing 24 packages (integration-only diff)                                                      |

## Authentication model

| Package  | Required env                           | Model                                |
| -------- | -------------------------------------- | ------------------------------------ |
| Outlook  | `OSVA_CONNECTOR_OUTLOOK_ACCESS_TOKEN`  | Delegated Graph bearer; host refresh |
| OneDrive | `OSVA_CONNECTOR_ONEDRIVE_ACCESS_TOKEN` | Delegated Graph bearer; host refresh |
| Teams    | `OSVA_CONNECTOR_TEAMS_ACCESS_TOKEN`    | Delegated Graph bearer; host refresh |

**No** OAuth consent server, **no** refresh token storage, **no** tokens in tool inputs, **no** application-only (client credentials) send path in Teams v0.1.0.

## Tool inventory

### Outlook

| Tool                      | Mode                   |
| ------------------------- | ---------------------- |
| `outlook.mailFolder.list` | Read                   |
| `outlook.message.list`    | Read                   |
| `outlook.message.get`     | Read                   |
| `outlook.message.search`  | Read                   |
| `outlook.calendar.list`   | Read                   |
| `outlook.event.list`      | Read                   |
| `outlook.event.get`       | Read                   |
| `outlook.message.send`    | Mutating (send gates)  |
| `outlook.event.create`    | Mutating (write gates) |

### OneDrive

| Tool                         | Mode                   |
| ---------------------------- | ---------------------- |
| `onedrive.drive.get`         | Read                   |
| `onedrive.item.list`         | Read                   |
| `onedrive.item.get`          | Read                   |
| `onedrive.file.read`         | Read                   |
| `onedrive.file.search`       | Read                   |
| `onedrive.file.upload.small` | Mutating (write gates) |

### Teams

| Tool                         | Mode                  |
| ---------------------------- | --------------------- |
| `teams.team.list`            | Read                  |
| `teams.channel.list`         | Read                  |
| `teams.channel.message.list` | Read                  |
| `teams.channel.reply.list`   | Read                  |
| `teams.chat.list`            | Read                  |
| `teams.chat.message.list`    | Read                  |
| `teams.channel.message.send` | Mutating (send gates) |
| `teams.chat.message.send`    | Mutating (send gates) |

## Permissions matrix (delegated — host registration)

| Tool / area            | Typical Graph delegated permissions                                    |
| ---------------------- | ---------------------------------------------------------------------- |
| Outlook mail reads     | `Mail.Read`                                                            |
| Outlook send           | `Mail.Send`                                                            |
| Outlook calendar reads | `Calendars.Read`                                                       |
| Outlook event create   | `Calendars.ReadWrite`                                                  |
| OneDrive reads         | `Files.Read`                                                           |
| OneDrive small upload  | `Files.ReadWrite`                                                      |
| Teams structure reads  | `Team.ReadBasic.All`, `Channel.ReadBasic.All`                          |
| Teams message reads    | `ChannelMessage.Read.All`, `Chat.Read`, `ChatMessage.Read` (as needed) |
| Teams sends            | `ChannelMessage.Send`, `ChatMessage.Send`                              |

Exact scope sets depend on host Entra app registration and admin consent policy.

## Host policy (common patterns)

| Mechanism         | Outlook                                                                                                          | OneDrive                                                           | Teams                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Allowlist envs    | mail folders, calendars                                                                                          | drives, root items                                                 | teams, channels, chats                                                      |
| Tri-state         | unset / deny-all / restrict                                                                                      | same                                                               | same                                                                        |
| Mutations / sends | `SEND_ENABLED` + `HOST_SEND_APPROVED` + recipient allowlist; `WRITE_ENABLED` + `HOST_WRITES_APPROVED` for events | `WRITE_ENABLED` + `HOST_WRITES_APPROVED` + upload folder allowlist | `SEND_ENABLED` + `HOST_SEND_APPROVED` + channel/chat destination allowlists |
| Pagination        | OData `@odata.nextLink` validated                                                                                | same                                                               | same                                                                        |
| API host          | Fixed `graph.microsoft.com` (test injectable loopback)                                                           | same                                                               | same                                                                        |

## Files added / changed (integration)

- **Updated:** `scripts/connector-packages.mjs`, root `package.json`
- **New:** `scripts/package-acceptance-{outlook,onedrive,teams}.mjs`, `*-smoke.mjs`
- **Updated:** `scripts/package-acceptance-npm-dry-run.mjs`
- **New:** `.github/workflows/npm-release-{outlook,onedrive,teams}.yml`
- **New:** `docs/INSTALL-{OUTLOOK,ONEDRIVE,TEAMS}.md`, `docs/RELEASE-CHECKLIST-{OUTLOOK,ONEDRIVE,TEAMS}.md`
- **Updated:** `docs/compatibility.md`, `README.md`
- **New:** `docs/IMPLEMENTATION_REPORT_B4_MICROSOFT_365.md`

## Testing

| Package   | Test files | Tests (vitest) |
| --------- | ---------- | -------------- |
| Outlook   | 8          | **20**         |
| OneDrive  | 8          | **35**         |
| Teams     | 7          | **20**         |
| **Total** | **23**     | **75**         |

Hermetic mock HTTP servers (`FAKE_*_ACCESS_TOKEN` fixtures) cover Graph routing, allowlist bypass attempts, send/write gates, pagination URL validation, credential redaction, MCP `tools/list` + `tools/call`.

Package acceptance smoke uses fixture tokens (`OSVA_CONNECTOR_*_ACCESS_TOKEN`) that do not call live Graph for discovery/schema checks; missing credentials must fail stdio startup.

## Security audit follow-up (2026-11-08)

| Finding                                                                               | Resolution                                                                                                |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Agent-supplied `nextLink` accepted any `/v1.0/` Graph URL (cross-resource pagination) | Per-operation path scope checks added (`OUTLOOK_*`, `TEAMS_*`, `ONEDRIVE_*` next-link scopes)             |
| INSTALL docs lacked explicit Teams send scope split / migration permission warning    | `INSTALL-TEAMS.md` documents `ChannelMessage.Send` vs `ChatMessage.Send`, excludes `Teamwork.Migrate.All` |
| Regression gaps for channel vs chat send allowlists, redirect follow, mutation retry  | Focused tests added (see test counts below)                                                               |

All other audited controls (recipient allowlists, redirect `manual`, tri-state allowlists, host approval env-only, SDK pin, release workflows) **confirmed** without code change.

## Verification results (2026-11-08, Windows / Node 24)

| Step                | Result                                                                      |
| ------------------- | --------------------------------------------------------------------------- |
| Prettier            | `pnpm format:check` — **pass**                                              |
| Lint (M365 only)    | `pnpm --filter @osva-ai/connector-{outlook,onedrive,teams} lint` — **pass** |
| Typecheck (M365)    | **pass**                                                                    |
| Unit tests          | **75/75 pass** (post-audit)                                                 |
| Production build    | **pass** (all three)                                                        |
| Package acceptance  | `pnpm test:package-acceptance:{outlook,onedrive,teams}` — **pass**          |
| `verify:boundaries` | **pass**                                                                    |
| `git diff --check`  | **pass**                                                                    |

**Deferred:** Live Graph calls with real tenant credentials (none in CI).

## Known limitations (v0.1.0)

- Delegated user tokens only (no connector-owned OAuth).
- No large-file upload session / resumable upload (OneDrive).
- No Teams app-only broadcast or bulk send tools.
- No arbitrary Graph query or OData passthrough tools.
- Message/calendar HTML treated as untrusted external content where applicable.

## PR readiness

**GO** — One confirmed security fix (cross-resource `nextLink` scope), docs aligned with Graph v1.0 delegated permissions, **75** unit tests pass, three package-acceptance smokes pass, boundaries/format/lint/typecheck pass. Uncommitted on `feat/b4-microsoft-365`; live-tenant Graph verification remains post-merge.

## npm publication readiness

- Packages build and unit-test in workspace; packaged MCP acceptance scripts wired.
- Release workflows and checklists in place (`dry_run` default **true**).
- **Status:** **Source-only** `@0.1.0` until manual workflow publish after PR merge.

## Recommended PR

**Title:** `feat(connectors): add Outlook, OneDrive, and Teams Graph MCP packages (B4.2)`

**Commit message:**

```
feat(connectors): integrate Microsoft 365 Outlook, OneDrive, Teams packages

Wire workspace scripts, package acceptance, release workflows, and docs for
three delegated Graph connectors at 0.1.0 (source-only until npm bootstrap).
```
