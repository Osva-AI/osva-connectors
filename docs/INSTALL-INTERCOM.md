# Install `@osva-ai/connector-intercom`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-intercom@0.1.1
npx osva-connector-intercom
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Required environment

Required: `OSVA_CONNECTOR_INTERCOM_ACCESS_TOKEN`, `OSVA_CONNECTOR_INTERCOM_REGION` (`us` / `eu` / `au`), `OSVA_CONNECTOR_INTERCOM_ADMIN_ID`. Mutations require `OSVA_CONNECTOR_INTERCOM_NOTES_ENABLED` / `OSVA_CONNECTOR_INTERCOM_STATUS_ENABLED`, `OSVA_CONNECTOR_INTERCOM_HOST_WRITES_APPROVED`, and `OSVA_CONNECTOR_INTERCOM_ALLOWED_RESOURCE_IDS` (conversation ids).

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-intercom": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-intercom@0.1.1"]
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

See [packages/intercom/README.md](../packages/intercom/README.md) for tools and environment variables.
