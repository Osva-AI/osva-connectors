# Install `@osva-ai/connector-zendesk`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Install from npm

```bash
npm install @osva-ai/connector-zendesk@0.1.0
npx osva-connector-zendesk
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Required environment

| Variable                           | Required | Notes                          |
| ---------------------------------- | -------- | ------------------------------ |
| `OSVA_CONNECTOR_ZENDESK_SUBDOMAIN` | Yes      | Zendesk subdomain              |
| `OSVA_CONNECTOR_ZENDESK_EMAIL`     | Yes      | Agent email for API token auth |
| `OSVA_CONNECTOR_ZENDESK_API_TOKEN` | Yes      | API token                      |

Mutations require `OSVA_CONNECTOR_ZENDESK_NOTES_ENABLED` / `OSVA_CONNECTOR_ZENDESK_STATUS_ENABLED`, `OSVA_CONNECTOR_ZENDESK_HOST_WRITES_APPROVED`, and `OSVA_CONNECTOR_ZENDESK_ALLOWED_TICKET_IDS`.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-zendesk": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-zendesk@0.1.0"]
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

See [packages/zendesk/README.md](../packages/zendesk/README.md) for tools and environment variables.
