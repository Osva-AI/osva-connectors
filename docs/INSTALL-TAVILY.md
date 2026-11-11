# Install `@osva-ai/connector-tavily`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Install from npm

```bash
npm install @osva-ai/connector-tavily@0.1.0
npx osva-connector-tavily
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Tavily API key

1. Create a [Tavily](https://tavily.com) account and API key (`tvly-…`).
2. Supply it only via `OSVA_CONNECTOR_TAVILY_API_KEY`.

Outbound HTTPS is fixed to **`https://api.tavily.com`** (`Authorization: Bearer`).

## Environment

| Variable                           | Required | Description     |
| ---------------------------------- | -------- | --------------- |
| `OSVA_CONNECTOR_TAVILY_API_KEY`    | Yes      | Tavily API key  |
| `OSVA_CONNECTOR_TAVILY_TIMEOUT_MS` | No       | Default `30000` |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-tavily": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-tavily@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_TAVILY_API_KEY": "${TAVILY_API_KEY_FROM_HOST_VAULT}"
      }
    }
  }
}
```

## Trust boundary

Local URL checks limit what you **ask** Tavily to crawl or extract. **Crawl and extract run on Tavily’s network**; connector-side caps (depth, limit, breadth) reduce cost risk but cannot guarantee provider-side consumption. Treat all page text as untrusted.

Tool reference: **[packages/tavily/README.md](../packages/tavily/README.md)**.
