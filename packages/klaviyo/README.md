# @osva-ai/connector-klaviyo

OSVA Connector Profile V1 **read-only** MCP connector for [Klaviyo](https://www.klaviyo.com/) (API revision **2026-10-15**).

Target first public npm version **`0.1.0`** — **not published yet**; see [docs/INSTALL-KLAVIYO.md](../../docs/INSTALL-KLAVIYO.md).

## Capabilities

Ten MCP tools (all read-only):

| Tool                      | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `klaviyo.account.get`     | Account metadata (`GET /accounts`, `accounts:read`)                             |
| `klaviyo.campaign.list`   | Campaign list with cursor pagination (`campaigns:read`)                         |
| `klaviyo.campaign.get`    | Single campaign (`campaigns:read`)                                              |
| `klaviyo.flow.list`       | Flow list (`flows:read`)                                                        |
| `klaviyo.flow.get`        | Single flow (`flows:read`)                                                      |
| `klaviyo.metric.list`     | Metrics list (`metrics:read`)                                                   |
| `klaviyo.metric.get`      | Single metric (`metrics:read`)                                                  |
| `klaviyo.event.list`      | Events in a datetime window (`metrics:read`, `events:read`; no profile include) |
| `klaviyo.report.campaign` | Campaign values report (`POST /campaign-values-reports/`)                       |
| `klaviyo.report.flow`     | Flow values report (`POST /flow-values-reports/`)                               |

Reporting tools require **`conversionMetricId`** (typically Placed Order from `klaviyo.metric.list`). Statistics and timeframe keys are allowlisted per Klaviyo Reporting API documentation. **`groupings`**, **`send_channel`**, and **`statistics`** in results are preserved as returned by Klaviyo.

## API

| Setting         | Value                           |
| --------------- | ------------------------------- |
| Base URL        | `https://a.klaviyo.com/api/`    |
| Revision header | `2026-10-15`                    |
| Authorization   | `Klaviyo-API-Key {private key}` |

## Environment variables

| Variable                                 | Required | Description                            |
| ---------------------------------------- | -------- | -------------------------------------- |
| `OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY` | Yes      | Klaviyo private API key                |
| `OSVA_CONNECTOR_KLAVIYO_TIMEOUT_MS`      | No       | Total deadline ms (default `30000`)    |
| `OSVA_CONNECTOR_KLAVIYO_MAX_ROWS`        | No       | Max rows per list tool (default `100`) |

Credentials are never accepted through MCP tool arguments.

## Security

- Fixed Klaviyo API host only in production (`a.klaviyo.com`).
- Bounded HTTP responses (2 MiB), one retry on 429/5xx with `Retry-After`.
- Pagination cursors validated; provider `links.next` hosts checked (never followed directly).
- POST is used only for read-only Reporting API query endpoints.
- **`klaviyo.event.list`** requests `fields[event]=id,datetime,timestamp,uuid` only; normalization drops `event_properties`, profile relationships, and other PII-bearing fields if the provider returns them anyway.

## v0.1.0 limitations

- **List tools** (`campaign.list`, `flow.list`, etc.) support pagination only — no archived/name/channel list filters yet.
- **Reporting `groupBy`** uses a subset of Klaviyo dimensions (not all tag/message group-bys).
- **Reporting `filter`** accepts a structured object (send channels, IDs, tags) — not raw Klaviyo filter strings.
- **Events** do not expose `event_properties` or profile data; there is no opt-in raw properties export.
- **OAuth**, mutation tools, and write scopes are out of scope for v0.1.0.

## Output budget

Structured MCP output is capped at **256 KiB** UTF-8 on `JSON.stringify(result)`.

## MCP stdio

Binary: `osva-connector-klaviyo` → `dist/stdio.js`.

```bash
pnpm --filter @osva-ai/connector-klaviyo test
pnpm --filter @osva-ai/connector-klaviyo build
```
