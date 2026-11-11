# Install `@osva-ai/connector-klaviyo`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Klaviyo API key

1. In Klaviyo, create a **Private API Key** with read scopes used by this connector:
   - `accounts:read`
   - `campaigns:read`
   - `flows:read`
   - `metrics:read`
   - `events:read`
2. Pin API revision **2026-10-15** (set automatically by the connector via the `revision` header).

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-klaviyo@0.1.0
export OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY="pk_your_private_key"
npx osva-connector-klaviyo
```

## Environment variables

| Variable                                 | Required | Notes                                      |
| ---------------------------------------- | -------- | ------------------------------------------ |
| `OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY` | Yes      | Private API key (`Klaviyo-API-Key` header) |
| `OSVA_CONNECTOR_KLAVIYO_TIMEOUT_MS`      | No       | Total deadline ms (default `30000`)        |
| `OSVA_CONNECTOR_KLAVIYO_MAX_ROWS`        | No       | Max list rows per tool (default `100`)     |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-klaviyo": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-klaviyo@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY": "pk_your_private_key"
      }
    }
  }
}
```

## Tool reference

See [packages/klaviyo/README.md](../packages/klaviyo/README.md).
