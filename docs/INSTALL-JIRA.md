# Install `@osva-ai/connector-jira`

**Node.js 24+.** SDK pin: `@osva-ai/connector-sdk@1.1.4`.

**Published npm version:** `@osva-ai/connector-jira@0.1.1` (install from registry; see [RELEASE-CHECKLIST-JIRA.md](./RELEASE-CHECKLIST-JIRA.md)).

## Jira credentials

Configure **one** of:

1. **Site + API token (Basic):** `OSVA_CONNECTOR_JIRA_SITE_URL` + `OSVA_CONNECTOR_JIRA_EMAIL` + `OSVA_CONNECTOR_JIRA_API_TOKEN`
2. **Site + OAuth/access token (Bearer):** `OSVA_CONNECTOR_JIRA_SITE_URL` + `OSVA_CONNECTOR_JIRA_ACCESS_TOKEN`
3. **Cloud ID + OAuth (Bearer on Atlassian API):** `OSVA_CONNECTOR_JIRA_CLOUD_ID` + `OSVA_CONNECTOR_JIRA_ACCESS_TOKEN`

This connector does not implement an OAuth login server.

## Environment

| Variable                                   | Required      | Description                                                         |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------- |
| `OSVA_CONNECTOR_JIRA_SITE_URL`             | Modes 1–2     | `https://your-site.atlassian.net`                                   |
| `OSVA_CONNECTOR_JIRA_CLOUD_ID`             | Mode 3        | Atlassian cloud ID                                                  |
| `OSVA_CONNECTOR_JIRA_EMAIL`                | Mode 1        | Account email                                                       |
| `OSVA_CONNECTOR_JIRA_API_TOKEN`            | Mode 1        | API token                                                           |
| `OSVA_CONNECTOR_JIRA_ACCESS_TOKEN`         | Modes 2–3     | OAuth or PAT bearer token                                           |
| `OSVA_CONNECTOR_JIRA_WRITE_ENABLED`        | For mutations | `true` to allow writes                                              |
| `OSVA_CONNECTOR_JIRA_HOST_WRITES_APPROVED` | For mutations | `true` after host workflow approval                                 |
| `OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS` | No            | Comma-separated keys; absent = unrestricted reads; empty = deny all |
| `OSVA_CONNECTOR_JIRA_TIMEOUT_MS`           | No            | Default `30000`                                                     |

When `OSVA_CONNECTOR_JIRA_ALLOWED_PROJECT_KEYS` is set, JQL is wrapped with `AND project in (...)` and cross-project JQL is rejected. Mutations require a **non-empty** allowlist when the env var is present.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-jira": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-jira@0.1.1"],
      "env": {
        "OSVA_CONNECTOR_JIRA_SITE_URL": "https://your-site.atlassian.net",
        "OSVA_CONNECTOR_JIRA_EMAIL": "${JIRA_EMAIL_FROM_HOST_VAULT}",
        "OSVA_CONNECTOR_JIRA_API_TOKEN": "${JIRA_API_TOKEN_FROM_HOST_VAULT}"
      }
    }
  }
}
```
