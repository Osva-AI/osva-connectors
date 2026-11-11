# Install `@osva-ai/connector-woocommerce`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Install from npm

```bash
npm install @osva-ai/connector-woocommerce@0.1.0
npx osva-connector-woocommerce
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Required environment

Required: `OSVA_CONNECTOR_WOOCOMMERCE_STORE_URL`, `OSVA_CONNECTOR_WOOCOMMERCE_CONSUMER_KEY`, `OSVA_CONNECTOR_WOOCOMMERCE_CONSUMER_SECRET`. Mutations require `OSVA_CONNECTOR_WOOCOMMERCE_WRITE_ENABLED` and `OSVA_CONNECTOR_WOOCOMMERCE_HOST_WRITES_APPROVED`.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-woocommerce": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-woocommerce@0.1.0"]
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

See [packages/woocommerce/README.md](../packages/woocommerce/README.md) for tools and environment variables.
