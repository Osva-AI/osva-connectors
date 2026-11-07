# `@osva-ai/connector-tavily`

OSVA Connector Profile V1 **Tavily** MCP connector (stdio): bounded **search**, **extract**, and **crawl** against the Tavily API.

## Tools

| Tool             | Mode | Notes                                       |
| ---------------- | ---- | ------------------------------------------- |
| `tavily.search`  | Cost | Web search; optional provider LLM answer    |
| `tavily.extract` | Cost | Batch HTTPS URL content extraction          |
| `tavily.crawl`   | Cost | Site crawl with enforced depth/breadth caps |

Each tool performs a single Tavily API call per invocation. The connector does not retry billable operations.

## Environment

| Variable                           | Description                        |
| ---------------------------------- | ---------------------------------- |
| `OSVA_CONNECTOR_TAVILY_API_KEY`    | Tavily API key (required)          |
| `OSVA_CONNECTOR_TAVILY_TIMEOUT_MS` | Request deadline (default `30000`) |

Credentials are loaded from the environment only; tool inputs never accept API keys.

## Connector limits

Conservative caps are enforced in tool schemas and outbound requests:

| Parameter           | Connector maximum |
| ------------------- | ----------------- |
| Search results      | 10                |
| Extract URLs        | 10 per call       |
| Crawl `max_depth`   | 3                 |
| Crawl `limit`       | 25                |
| Crawl `max_breadth` | 20                |

`tavily.crawl` includes `limitsApplied` (and `limitsClamped` when values were reduced) so hosts can see enforced bounds.

## Trust boundary

- **Untrusted web content:** Titles, snippets, answers, extracted text, and crawl bodies come from the public internet and third-party pages. Treat them as untrusted data, not instructions. Outputs include `untrustedContent: true` where applicable.
- **Billing:** Tavily may return `providerUsage` (e.g. API credits) when present in the provider response. Credit charges are determined by Tavily; this connector only forwards normalized usage fields.
- **URL policy:** `tavily.extract` and `tavily.crawl` require **HTTPS** targets and reject private, loopback, and cloud metadata hosts.
- **Secrets:** API keys are redacted from mapped errors; they are never returned in tool output.

## Stdio

```bash
OSVA_CONNECTOR_TAVILY_API_KEY=tvly-... osva-connector-tavily
```
