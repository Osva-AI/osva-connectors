# Install `@osva-ai/connector-firecrawl`

**Node.js 24+.** SDK pin: `@osva-ai/connector-sdk@1.1.4`.

**Published:** `@osva-ai/connector-firecrawl@0.1.0` on npm ([B3 publication record](./B3_PUBLICATION_RECORD.md)).

## Firecrawl API key

1. Create a [Firecrawl](https://firecrawl.dev) account and API key (`fc-…`).
2. Supply it only via `OSVA_CONNECTOR_FIRECRAWL_API_KEY`.

Outbound HTTPS is fixed to **`https://api.firecrawl.dev/v2`** (`Authorization: Bearer`).

## Environment

| Variable                              | Required | Description       |
| ------------------------------------- | -------- | ----------------- |
| `OSVA_CONNECTOR_FIRECRAWL_API_KEY`    | Yes      | Firecrawl API key |
| `OSVA_CONNECTOR_FIRECRAWL_TIMEOUT_MS` | No       | Default `60000`   |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-firecrawl": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-firecrawl@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY_FROM_HOST_VAULT}"
      }
    }
  }
}
```

## Async crawls

Use `firecrawl.crawl.start` to obtain a `crawlId`, then poll `firecrawl.crawl.status` (no long-running MCP call until completion). Pagination uses provider `next` URLs when present.

## Trust boundary

Scrape/search/map/crawl operations execute on **Firecrawl infrastructure**. URL validation applies to user inputs; returned markdown is untrusted. No browser interact, arbitrary JS, or webhooks in v0.1.0.

Tool reference: **[packages/firecrawl/README.md](../packages/firecrawl/README.md)**.
