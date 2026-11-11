# Install `@osva-ai/connector-bigcommerce`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Install from npm

```bash
npm install @osva-ai/connector-bigcommerce@0.1.0
npx osva-connector-bigcommerce
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Required environment

Required: `OSVA_CONNECTOR_BIGCOMMERCE_STORE_HASH`, `OSVA_CONNECTOR_BIGCOMMERCE_ACCESS_TOKEN`. Mutations require `OSVA_CONNECTOR_BIGCOMMERCE_WRITE_ENABLED` and `OSVA_CONNECTOR_BIGCOMMERCE_HOST_WRITES_APPROVED`.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-bigcommerce": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-bigcommerce@0.1.0"]
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

See [packages/bigcommerce/README.md](../packages/bigcommerce/README.md) for tools and environment variables.
