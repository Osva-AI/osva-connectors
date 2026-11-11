# Install `@osva-ai/connector-outlook`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-outlook@0.1.1
npx osva-connector-outlook
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Microsoft Graph (delegated)

| Variable                              | Required | Description                                           |
| ------------------------------------- | -------- | ----------------------------------------------------- |
| `OSVA_CONNECTOR_OUTLOOK_ACCESS_TOKEN` | **Yes**  | Delegated user OAuth access token for Microsoft Graph |

The host must obtain and refresh tokens; this connector does not run an OAuth server.

Typical **delegated** scopes (Microsoft Graph v1.0 `/me` endpoints):

| Operation                           | Permission            |
| ----------------------------------- | --------------------- |
| Mail folder / message reads, search | `Mail.Read`           |
| `outlook.message.send`              | `Mail.Send`           |
| Calendar / event reads              | `Calendars.Read`      |
| `outlook.event.create`              | `Calendars.ReadWrite` |

Missing scopes surface as Graph **401/403**; the connector maps them to `UNAUTHORIZED` / `FORBIDDEN` without retrying mutations.

## Optional policy

| Variable                                         | Description                           |
| ------------------------------------------------ | ------------------------------------- |
| `OSVA_CONNECTOR_OUTLOOK_TIMEOUT_MS`              | HTTP timeout (default `30000`)        |
| `OSVA_CONNECTOR_OUTLOOK_ALLOWED_MAIL_FOLDER_IDS` | Tri-state mail folder allowlist       |
| `OSVA_CONNECTOR_OUTLOOK_ALLOWED_CALENDAR_IDS`    | Tri-state calendar allowlist          |
| `OSVA_CONNECTOR_OUTLOOK_SEND_ENABLED`            | Enable `outlook.message.send`         |
| `OSVA_CONNECTOR_OUTLOOK_HOST_SEND_APPROVED`      | Host send approval                    |
| `OSVA_CONNECTOR_OUTLOOK_ALLOWED_RECIPIENTS`      | Recipient allowlist when send enabled |
| `OSVA_CONNECTOR_OUTLOOK_WRITE_ENABLED`           | Enable `outlook.event.create`         |
| `OSVA_CONNECTOR_OUTLOOK_HOST_WRITES_APPROVED`    | Host calendar write approval          |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-outlook": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-outlook@0.1.1"],
      "env": {
        "OSVA_CONNECTOR_OUTLOOK_ACCESS_TOKEN": "${GRAPH_DELEGATED_TOKEN_FROM_HOST_VAULT}"
      }
    }
  }
}
```
