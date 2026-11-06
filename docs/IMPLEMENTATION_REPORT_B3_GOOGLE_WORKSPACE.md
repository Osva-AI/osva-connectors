# Implementation report — B3.1 Google Workspace (`feat/b3-google-workspace`)

## Summary

Two new publishable packages were added under OSVA Connector Profile V1:

- [`@osva-ai/connector-gmail`](../packages/gmail) (`packages/gmail`) — Gmail API v1 with **10** MCP tools.
- [`@osva-ai/connector-google-calendar`](../packages/google-calendar) (`packages/google-calendar`) — Calendar API v3 with **7** MCP tools.

Both use **`@osva-ai/connector-sdk@1.1.4`**, **`zod` v4**, bounded fetch reads, Google-style error mapping, credential redaction hooks, stdio entrypoints, and package acceptance scripts mirroring existing Google connectors.

## Phase 1 — Audit (reused patterns)

Patterns aligned with **`packages/google-drive`**, **`packages/google-sheets`**, **`packages/gsc`**, and **`packages/slack`**:

- **Auth:** `google-auth-library` `GoogleAuth` + `JWT.subject` for optional Workspace domain-wide delegation; optional **`createStaticBearerTokenProvider`** for host OAuth access tokens (`OSVA_CONNECTOR_*_ACCESS_TOKEN`).
- **HTTP:** Fixed HTTPS allowlists to `gmail.googleapis.com` / `www.googleapis.com`, bounded response bodies, **GET retry** for 429/5xx with caps, **no automatic retry** on mutations (Gmail send/drafts; Calendar POST/PATCH/DELETE).
- **Errors:** `map*Error` maps Google `error.status` + HTTP **401/403/404/429/5xx** to `ConnectorSdkError` codes; mutation paths mark ambiguous failures **non-retryable** (Sheets-style send guidance).
- **MCP:** `defineConnector` / `defineTool`, strict Zod + parallel JSON Schema, `serveStdio` in `stdio.ts`.
- **Gmail-specific:** Personal mailboxes usually need **delegated user OAuth**; ADC alone is documented as insufficient for typical consumer Gmail — hosts supply **`OSVA_CONNECTOR_GMAIL_ACCESS_TOKEN`** or Workspace delegation when appropriate.

## Gmail — tools and policy

| Tool                                                                                                                                            | Gating                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `gmail.profile.get`, `gmail.message.list`, `gmail.message.get`, `gmail.thread.list`, `gmail.thread.get`, `gmail.label.list`, `gmail.draft.list` | Read scopes default                                                                                         |
| `gmail.draft.create`, `gmail.draft.update`                                                                                                      | `OSVA_CONNECTOR_GMAIL_DRAFTS_ENABLED=true` **and** recipient allowlist                                      |
| `gmail.message.send`                                                                                                                            | `OSVA_CONNECTOR_GMAIL_SEND_ENABLED=true`, `OSVA_CONNECTOR_GMAIL_HOST_SEND_APPROVED=true`, **and** allowlist |

**Trusted host approval (connector boundary):** `hostSendApproved`, `sendEnabled`, `draftsEnabled`, and `allowedRecipients` are **only** supplied from `loadGmailConfig(process.env)` — they are **not** tool inputs. The MCP tool layer has no field for agents to assert approval; a trusted host or supervisor must set environment variables (or equivalent process env) before stdio startup.

Recipient addresses from tools and from `OSVA_CONNECTOR_GMAIL_ALLOWED_RECIPIENTS` are **canonicalized** to a strict bare addr-spec (RFC-like), with rejection of header injection, group syntax, commas in one field, and residual angle brackets. Allowlist checks use the same canonical form as the generated `To`/`Cc`/`Bcc` headers so **Cc/Bcc/display-name tricks** cannot bypass the list. Compose tool schemas apply the same transform so invalid addresses fail at validation.

**Not supported in v0.1.0:** attachments, HTML-only composition helpers (plain text only), `users.drafts.send`.

## Google Calendar — tools and policy

| Tool                                                                                             | Notes                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendar.calendar.list`, `calendar.event.list`, `calendar.event.get`, `calendar.freebusy.query` | Read-oriented defaults                                                                                                                                              |
| `calendar.event.create`, `calendar.event.update`, `calendar.event.delete`                        | `OSVA_CONNECTOR_GOOGLE_CALENDAR_WRITE_ENABLED`, `OSVA_CONNECTOR_GOOGLE_CALENDAR_HOST_MUTATIONS_APPROVED`, **`OSVA_CONNECTOR_GOOGLE_CALENDAR_ALLOWED_CALENDAR_IDS`** |

**Calendar ID allowlist semantics:** **Unset** env var → connector applies **no id restriction** for reads (API permissions still apply). **Non-empty comma-separated list** → only those ids are used for read and mutate paths that take a `calendarId` / freeBusy item `id`. **Explicit empty value** (`OSVA_CONNECTOR_GOOGLE_CALENDAR_ALLOWED_CALENDAR_IDS=` or whitespace-only) → **deny-all**: `calendar.calendar.list` returns no calendars; event get/list, free/busy, and mutations reject every calendar id.

**Trusted host approval (connector boundary):** `writeEnabled`, `hostMutationsApproved`, and `allowedCalendarIds` come **only** from `loadGoogleCalendarConfig(process.env)` — they are **not** tool arguments. Tools cannot toggle approval or write gates.

`calendar.calendar.list` filters the provider response when a non-empty allowlist is configured. Event list and free/busy inputs require **`timeMin` &lt; `timeMax`** when both bounds are provided (invalid ranges are rejected before calling the API).

`calendar.event.update` uses **`events.patch`** (partial update). Recurrence/series semantics are **provider-defined**; list tools document `singleEvents` + `orderBy` for instance expansion.

## Engineering verification (executed on this branch)

| Step                        | Command                                                                                                                                                    | Result (cached run)                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Install                     | `pnpm install`                                                                                                                                             | OK                                         |
| Build                       | `pnpm --filter @osva-ai/connector-gmail --filter @osva-ai/connector-google-calendar build`                                                                 | OK                                         |
| Lint                        | `pnpm --filter @osva-ai/connector-gmail --filter @osva-ai/connector-google-calendar lint`                                                                  | OK                                         |
| Typecheck                   | `pnpm --filter @osva-ai/connector-gmail --filter @osva-ai/connector-google-calendar typecheck`                                                             | OK                                         |
| Unit / integration (vitest) | `pnpm --filter @osva-ai/connector-gmail --filter @osva-ai/connector-google-calendar test`                                                                  | OK                                         |
| Boundaries                  | `pnpm verify:boundaries`                                                                                                                                   | OK                                         |
| Prettier (new code)         | `pnpm exec prettier --write packages/gmail packages/google-calendar scripts/package-acceptance-gmail*.mjs scripts/package-acceptance-google-calendar*.mjs` | OK                                         |
| Acceptance (gmail)          | `node scripts/package-acceptance-gmail.mjs`                                                                                                                | OK (temp dir cleaned; tarball path logged) |
| Acceptance (calendar)       | `node scripts/package-acceptance-google-calendar.mjs`                                                                                                      | OK                                         |

**Deferred:** Live calls to Google production APIs (no real credentials in CI); validate with host-managed tokens and real calendars/mailboxes when ready.

**Note:** Repository file `ENGINEERING_VERIFICATION_PLAYBOOK.md` was **not present** in this checkout; verification followed existing **[docs/RELEASE-CHECKLIST-GOOGLE-SHEETS.md](RELEASE-CHECKLIST-GOOGLE-SHEETS.md)**-style steps and new checklists ([Gmail](RELEASE-CHECKLIST-GMAIL.md), [Calendar](RELEASE-CHECKLIST-GOOGLE-CALENDAR.md)).

## Security limitations

- **No credential persistence** in-process beyond environment variables for the connector lifetime.
- **Gmail:** Recipient enforcement is **allowlist-only** (To/Cc/Bcc); no attachment support reduces exfil surface; sends are **never auto-retried**. Address parsing and MIME assembly reject values that could smuggle extra headers or multiple recipients in one field.
- **Calendar:** Optional calendar ID allowlist: **unset** = connector does not filter read tools by id; **non-empty list** = restrict reads and mutations to those ids; **explicit empty env value** = deny-all. Descriptions/snippets are **untrusted**; free/busy returns provider blobs under `untrustedContent`.
- **Domain-wide delegation:** Impersonation applies only on the **service-account JWT** path when `useDomainDelegation` and `delegatedUserEmail` are set (see `gmail-auth` / calendar auth). Host-supplied **`OSVA_CONNECTOR_*_ACCESS_TOKEN`** bypasses `JWT.subject` — that path does **not** implement delegation by itself.
- OAuth scopes may be **sensitive / restricted**; public client verification may be required by Google.

## Release automation

Manual GitHub Actions workflows (same pattern as GA4: `workflow_dispatch`, `main` only, default `dry_run`, OIDC publish path with no empty `NODE_AUTH_TOKEN`, optional `NPM_TOKEN` fallback):

- [`.github/workflows/npm-release-gmail.yml`](../.github/workflows/npm-release-gmail.yml)
- [`.github/workflows/npm-release-google-calendar.yml`](../.github/workflows/npm-release-google-calendar.yml)

## Branch

Work is on **`feat/b3-google-workspace`** (no commit/push requested).
