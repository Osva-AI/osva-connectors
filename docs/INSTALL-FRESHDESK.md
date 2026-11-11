# Install `@osva-ai/connector-freshdesk`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-freshdesk@0.1.1
npx osva-connector-freshdesk
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Required environment

Required: `OSVA_CONNECTOR_FRESHDESK_DOMAIN`, `OSVA_CONNECTOR_FRESHDESK_API_KEY`. Mutations require `OSVA_CONNECTOR_FRESHDESK_NOTES_ENABLED` / `OSVA_CONNECTOR_FRESHDESK_STATUS_ENABLED`, `OSVA_CONNECTOR_FRESHDESK_HOST_WRITES_APPROVED`, and `OSVA_CONNECTOR_FRESHDESK_ALLOWED_RESOURCE_IDS`.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-freshdesk": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-freshdesk@0.1.1"]
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

See [packages/freshdesk/README.md](../packages/freshdesk/README.md) for tools and environment variables.
