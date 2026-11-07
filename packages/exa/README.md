# `@osva-ai/connector-exa`

OSVA Connector Profile V1 **read-only** Exa MCP connector (stdio). Calls fixed `https://api.exa.ai` endpoints only.

## Credentials

| Variable                        | Required | Description                                                                               |
| ------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_EXA_API_KEY`    | Yes      | Exa API key. Sent as `x-api-key` on every request. Never pass keys in MCP tool arguments. |
| `OSVA_CONNECTOR_EXA_TIMEOUT_MS` | No       | Per-request deadline (default `30000`, range `1000`–`120000`).                            |

Exa's public API also accepts `Authorization: Bearer <key>`. This connector uses **`x-api-key`** only.

## Tools

| Tool               | Exa endpoint     | Description                                          |
| ------------------ | ---------------- | ---------------------------------------------------- |
| `exa.search`       | `POST /search`   | Web search with optional text/highlights in results. |
| `exa.contents.get` | `POST /contents` | Fetch content for caller-supplied **HTTPS** URLs.    |
| `exa.answer`       | `POST /answer`   | Provider-generated answer with citations (billable). |

`findSimilar` and other endpoints are not exposed.

## Security

- User URLs for `exa.contents.get` must be **HTTPS**. Private, loopback, link-local, and metadata hosts (e.g. `metadata.google.internal`) are rejected.
- Search hits, page text, highlights, and answers are **untrusted** web content (`untrustedContent: true`).
- `exa.answer` responses include an **`answerDisclaimer`**: the provider answer is **not independently verified**.
- Search and contents requests use bounded read retries on transient failures. **`exa.answer` is single-shot** (no connector-level retries).

## Output bounds

Structured MCP JSON output is capped at **256 KiB** UTF-8 per tool call. HTTP responses are capped at **2 MiB** before parsing.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-exa": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-exa@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_EXA_API_KEY": "your-exa-api-key"
      }
    }
  }
}
```

## Development

```bash
pnpm --filter @osva-ai/connector-exa build
pnpm --filter @osva-ai/connector-exa test
```
