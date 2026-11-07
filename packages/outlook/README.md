# @osva-ai/connector-outlook

OSVA Connector Profile V1 MCP connector for Microsoft Outlook via **Microsoft Graph** (delegated `/me` only).

## Authentication

The host supplies a delegated OAuth access token:

| Variable                              | Required | Description                                     |
| ------------------------------------- | -------- | ----------------------------------------------- |
| `OSVA_CONNECTOR_OUTLOOK_ACCESS_TOKEN` | **Yes**  | Bearer token for Graph (delegated permissions). |

Base URL: `https://graph.microsoft.com/v1.0`. This package does not run an OAuth server (app-only deferred).

## Optional configuration

| Variable                                         | Default   | Description                                                           |
| ------------------------------------------------ | --------- | --------------------------------------------------------------------- |
| `OSVA_CONNECTOR_OUTLOOK_TIMEOUT_MS`              | `30000`   | HTTP timeout (ms).                                                    |
| `OSVA_CONNECTOR_OUTLOOK_ALLOWED_MAIL_FOLDER_IDS` | _(unset)_ | Tri-state comma-separated folder IDs (unset = all, empty = deny all). |
| `OSVA_CONNECTOR_OUTLOOK_ALLOWED_CALENDAR_IDS`    | _(unset)_ | Tri-state calendar ID allowlist.                                      |
| `OSVA_CONNECTOR_OUTLOOK_SEND_ENABLED`            | `false`   | Enable `outlook.message.send`.                                        |
| `OSVA_CONNECTOR_OUTLOOK_HOST_SEND_APPROVED`      | `false`   | Host workflow approval for send.                                      |
| `OSVA_CONNECTOR_OUTLOOK_ALLOWED_RECIPIENTS`      | _(unset)_ | Required when send enabled — comma-separated recipient allowlist.     |
| `OSVA_CONNECTOR_OUTLOOK_WRITE_ENABLED`           | `false`   | Enable `outlook.event.create`.                                        |
| `OSVA_CONNECTOR_OUTLOOK_HOST_WRITES_APPROVED`    | `false`   | Host approval for calendar writes.                                    |

## Tools

**Read:** `outlook.mailFolder.list`, `outlook.message.list`, `outlook.message.get`, `outlook.message.search`, `outlook.calendar.list`, `outlook.event.list`, `outlook.event.get`

**Mutations (gated):** `outlook.message.send` (202 Accepted), `outlook.event.create`

## Run (stdio)

```bash
export OSVA_CONNECTOR_OUTLOOK_ACCESS_TOKEN="<delegated-token>"
npx osva-connector-outlook
```

## Development

```bash
npm run typecheck
npm test
```

## License

Apache-2.0
