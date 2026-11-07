# Install `@osva-ai/connector-tavily`

**Node.js 24+.** SDK pin: `@osva-ai/connector-sdk@1.1.4`.

**Published:** `@osva-ai/connector-tavily@0.1.0` on npm ([B3 publication record](./B3_PUBLICATION_RECORD.md)).

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
