# Install `@osva-ai/connector-confluence`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Install from npm

```bash
npm install @osva-ai/connector-confluence@0.1.0
npx osva-connector-confluence
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Confluence credentials

Configure **one** of:

1. **Site + basic:** `OSVA_CONNECTOR_CONFLUENCE_SITE_URL` + `OSVA_CONNECTOR_CONFLUENCE_EMAIL` + `OSVA_CONNECTOR_CONFLUENCE_API_TOKEN` → `https://{site}/wiki/api/v2/`
2. **Site + bearer:** `OSVA_CONNECTOR_CONFLUENCE_SITE_URL` + `OSVA_CONNECTOR_CONFLUENCE_ACCESS_TOKEN`
3. **Gateway:** `OSVA_CONNECTOR_CONFLUENCE_CLOUD_ID` + `OSVA_CONNECTOR_CONFLUENCE_ACCESS_TOKEN` → `https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2/`

CQL search uses `.../wiki/rest/api/search` on the same host mode.

This connector does not implement an OAuth login server.

## Environment

| Variable                                         | Required      | Description                                                       |
| ------------------------------------------------ | ------------- | ----------------------------------------------------------------- |
| `OSVA_CONNECTOR_CONFLUENCE_SITE_URL`             | Modes 1–2     | `https://your-site.atlassian.net`                                 |
| `OSVA_CONNECTOR_CONFLUENCE_CLOUD_ID`             | Mode 3        | Atlassian cloud ID                                                |
| `OSVA_CONNECTOR_CONFLUENCE_EMAIL`                | Mode 1        | Atlassian account email                                           |
| `OSVA_CONNECTOR_CONFLUENCE_API_TOKEN`            | Mode 1        | Atlassian API token                                               |
| `OSVA_CONNECTOR_CONFLUENCE_ACCESS_TOKEN`         | Modes 2–3     | OAuth access token                                                |
| `OSVA_CONNECTOR_CONFLUENCE_WRITE_ENABLED`        | For mutations | `true` to allow mutations                                         |
| `OSVA_CONNECTOR_CONFLUENCE_HOST_WRITES_APPROVED` | For mutations | `true` after host workflow approval                               |
| `OSVA_CONNECTOR_CONFLUENCE_ALLOWED_SPACE_IDS`    | No            | Tri-state space allowlist (unset / IDs / explicit empty deny-all) |
| `OSVA_CONNECTOR_CONFLUENCE_TIMEOUT_MS`           | No            | Default `30000`                                                   |

### Space allowlist (`OSVA_CONNECTOR_CONFLUENCE_ALLOWED_SPACE_IDS`)

- **Unset:** no connector-level space restriction on reads (API permissions still apply).
- **Non-empty comma-separated numeric space IDs:** reads, writes, and CQL are scoped to those spaces.
- **Explicit empty value:** **deny-all** — list/search return empty sets; get/create/update are rejected.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-confluence": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-confluence@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_CONFLUENCE_SITE_URL": "https://your-site.atlassian.net",
        "OSVA_CONNECTOR_CONFLUENCE_EMAIL": "${CONFLUENCE_EMAIL_FROM_HOST_VAULT}",
        "OSVA_CONNECTOR_CONFLUENCE_API_TOKEN": "${CONFLUENCE_API_TOKEN_FROM_HOST_VAULT}"
      }
    }
  }
}
```
