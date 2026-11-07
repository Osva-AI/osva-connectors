# @osva-ai/connector-gmail

OSVA Connector Profile V1 **Gmail** MCP connector (stdio): bounded **reads**, **labels**, **draft listing**, and **plain-text draft compose / send** when explicitly enabled by the host.

Published on npm as **`@osva-ai/connector-gmail@0.1.0`** ([B3 record](../../docs/B3_PUBLICATION_RECORD.md)). Before a patch release, run `pnpm test:package-acceptance:gmail` and `pnpm test:package-acceptance:registry-b3`.

## Capabilities

| Tool                 | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `gmail.profile.get`  | Mailbox profile (`users.getProfile`)                               |
| `gmail.message.list` | Message IDs (`users.messages.list`)                                |
| `gmail.message.get`  | Message detail (`users.messages.get`)                              |
| `gmail.thread.list`  | Thread IDs (`users.threads.list`)                                  |
| `gmail.thread.get`   | Thread detail (`users.threads.get`)                                |
| `gmail.label.list`   | Labels (`users.labels.list`)                                       |
| `gmail.draft.list`   | Draft IDs (`users.drafts.list`)                                    |
| `gmail.draft.create` | Create draft (`users.drafts.create`) — host-gated                  |
| `gmail.draft.update` | Replace draft (`users.drafts.update`) — host-gated                 |
| `gmail.message.send` | Send message (`users.messages.send`) — host-gated, **not retried** |

Read tools are available with **read-only** scopes. Draft and send tools require additional host configuration (see below).

## Google API

| API      | Host                                    |
| -------- | --------------------------------------- |
| Gmail v1 | `https://gmail.googleapis.com/gmail/v1` |

## Authentication (no tool-argument credentials)

Ordinary Gmail access typically requires **delegated user OAuth** (refreshable tokens managed by the **host**). This connector does **not** implement OAuth flows or persist refresh tokens.

Supported credential modes:

1. **Host-injected OAuth access token** — set `OSVA_CONNECTOR_GMAIL_ACCESS_TOKEN` to a short-lived bearer issued by the host’s token service. The connector uses it as a static bearer for the process lifetime only.

2. **Application Default Credentials** — `google-auth-library` with `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default login`. Scopes default from configuration (see [docs/INSTALL-GMAIL.md](../../docs/INSTALL-GMAIL.md)).

3. **Workspace domain-wide delegation (explicit only)** — set `OSVA_CONNECTOR_GMAIL_USE_DOMAIN_DELEGATION=true` and `OSVA_CONNECTOR_GMAIL_DELEGATED_USER_EMAIL`. Requires a **service account** and admin-consented domain-wide delegation. **Do not** combine with `OSVA_CONNECTOR_GMAIL_ACCESS_TOKEN`.

## Host policy: drafts and sends

| Gate                                             | Environment variable                           |
| ------------------------------------------------ | ---------------------------------------------- |
| Allow draft create/update                        | `OSVA_CONNECTOR_GMAIL_DRAFTS_ENABLED=true`     |
| Allow send                                       | `OSVA_CONNECTOR_GMAIL_SEND_ENABLED=true`       |
| Host workflow approval for send                  | `OSVA_CONNECTOR_GMAIL_HOST_SEND_APPROVED=true` |
| Recipient allowlist (To/Cc/Bcc), comma-separated | `OSVA_CONNECTOR_GMAIL_ALLOWED_RECIPIENTS`      |

Allowlist entries and tool-supplied To/Cc/Bcc values are validated to a **single canonical email** each (no display names, commas in one field, or header-injection characters), and the same form is used when building outbound MIME headers.

**Attachments are not supported** in v0.1.0. Composed messages are plain UTF-8 only.

Sends are **non-idempotent**; the HTTP client performs **no automatic retries** on mutation endpoints.

## Output and trust

- Structured MCP output is capped (see `OUTPUT_MAX_STRUCTURED_JSON_BYTES` in `src/constants.ts`).
- Email snippets, bodies, and headers are marked **`untrustedContent`** where applicable.

## MCP stdio

```bash
npx osva-connector-gmail
```

Programmatic use:

```ts
import {
  createGmailConnector,
  createGmailRestClient,
} from "@osva-ai/connector-gmail";
```

See [docs/INSTALL-GMAIL.md](../../docs/INSTALL-GMAIL.md).
