# `@osva-ai/connector-firecrawl`

OSVA Connector Profile V1 **Firecrawl** MCP connector (stdio): bounded **scrape**, **search**, **map**, and **async crawl** (start + status with pagination).

## Tools

| Tool                     | Billing / egress notes                                  |
| ------------------------ | ------------------------------------------------------- |
| `firecrawl.scrape`       | **Metered** — one scrape credit per provider pricing    |
| `firecrawl.search`       | **Metered** — search + optional page fetches            |
| `firecrawl.map`          | **Metered** — URL discovery                             |
| `firecrawl.crawl.start`  | **Metered** — starts async multi-page crawl (POST only) |
| `firecrawl.crawl.status` | **Metered** — status/result reads; use explicit polling |

Each tool maps to a **single Firecrawl API call** per MCP invocation (no automatic polling loop in stdio). `firecrawl.crawl.start` returns only a **crawl job ID**; poll with `firecrawl.crawl.status`. Billable POST operations (**scrape**, **search**, **map**, **crawl start**) are **not retried** by the connector.

### Trust boundary

User-supplied scrape/map/crawl targets must be **HTTPS** and are checked for private, loopback, and metadata hosts **before** the request is sent. Firecrawl still fetches pages on **provider infrastructure** (redirects, DNS, and crawl breadth are not fully controlled from OSVA). Treat returned markdown as untrusted.

## Environment

| Variable                              | Description                      |
| ------------------------------------- | -------------------------------- |
| `OSVA_CONNECTOR_FIRECRAWL_API_KEY`    | Firecrawl API key (required)     |
| `OSVA_CONNECTOR_FIRECRAWL_TIMEOUT_MS` | Request deadline (default 60000) |

## Security

- API keys are redacted from mapped errors; never returned in tool output.
- Scraped markdown and search results are **untrusted** external content.
- Outbound HTTPS is restricted to the Firecrawl v2 API host (`https://api.firecrawl.dev/v2`). Crawl pagination `next` URLs are allowlisted to the same host at request time.
- No browser interaction, webhooks, or agent endpoints are exposed.
