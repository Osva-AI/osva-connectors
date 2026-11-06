# Install `@osva-ai/connector-google-calendar`

Quickstart for running the Google Calendar connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:google-calendar` until bootstrap publish.

## Google Cloud

1. Create or select a [Google Cloud project](https://console.cloud.google.com/).
2. Enable **Google Calendar API**.
3. Credentials (host-managed):
   - **Access token:** `OSVA_CONNECTOR_GOOGLE_CALENDAR_ACCESS_TOKEN`, **or**
   - **ADC / service account:** `GOOGLE_APPLICATION_CREDENTIALS`.

Default scopes (unless `OSVA_CONNECTOR_GOOGLE_CALENDAR_SCOPES` overrides):

| Configuration       | Scopes                                                 |
| ------------------- | ------------------------------------------------------ |
| Read-only (default) | `https://www.googleapis.com/auth/calendar.readonly`    |
| Write enabled       | Adds `https://www.googleapis.com/auth/calendar.events` |

## Mutations (explicit)

| Variable                                                 | Value                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_WRITE_ENABLED`           | `true`                                                                         |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_HOST_MUTATIONS_APPROVED` | `true` (required whenever write is enabled)                                    |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_ALLOWED_CALENDAR_IDS`    | Comma-separated calendar IDs (e.g. `primary`, `group.calendar.google.com/...`) |

All mutation tools assert the target `calendarId` is in this allowlist.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-google-calendar@0.1.0
npx osva-connector-google-calendar
```

## Environment variables

| Variable                                                 | Required                     | Description                            |
| -------------------------------------------------------- | ---------------------------- | -------------------------------------- |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_ACCESS_TOKEN`            | One of token **or** ADC      | Short-lived OAuth bearer from the host |
| `GOOGLE_APPLICATION_CREDENTIALS`                         | For SA / ADC                 | Service account JSON path              |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_TIMEOUT_MS`              | No                           | Request deadline ms (default `30000`)  |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_SCOPES`                  | No                           | Override scope list                    |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_USE_DOMAIN_DELEGATION`   | No                           | `true` for Workspace JWT impersonation |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_DELEGATED_USER_EMAIL`    | With delegation              | User to impersonate                    |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_WRITE_ENABLED`           | For mutations                | `true`                                 |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_HOST_MUTATIONS_APPROVED` | For mutations                | `true` after sign-off                  |
| `OSVA_CONNECTOR_GOOGLE_CALENDAR_ALLOWED_CALENDAR_IDS`    | For mutations / scoped reads | Comma-separated allowlist              |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-google-calendar": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-google-calendar@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_GOOGLE_CALENDAR_ACCESS_TOKEN": "${CAL_ACCESS_TOKEN_FROM_HOST}"
      }
    }
  }
}
```

## Package acceptance

```bash
pnpm test:package-acceptance:google-calendar
```
