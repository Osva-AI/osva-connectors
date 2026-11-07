# @osva-ai/connector-amplitude

OSVA Connector Profile V1 **read-only** MCP connector for [Amplitude](https://amplitude.com/) Dashboard REST analytics.

Target first public npm version **`0.1.0`**.

## Capabilities

Seven MCP tools (all read-only Dashboard REST `GET`):

| Tool                           | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `amplitude.event.list`         | Event type catalog (`GET /api/2/events/list`)                |
| `amplitude.event.segmentation` | Event segmentation series (`GET /api/2/events/segmentation`) |
| `amplitude.funnel.run`         | Funnel analysis (`GET /api/2/funnels`)                       |
| `amplitude.retention.run`      | Retention analysis (`GET /api/2/retention`)                  |
| `amplitude.user.active`        | Aggregate active/new user series (`GET /api/2/users`)        |
| `amplitude.chart.get`          | Saved chart query (`GET /api/3/chart/{id}/query`)            |
| `amplitude.session.average`    | Average session length (`GET /api/2/sessions/average`)       |

Per-user activity search endpoints (`usersearch`, `useractivity`) are intentionally **not** exposed.

## API

| Setting       | Value                                |
| ------------- | ------------------------------------ |
| US host       | `https://amplitude.com`              |
| EU host       | `https://analytics.eu.amplitude.com` |
| Authorization | HTTP Basic `api_key:secret_key`      |

## Environment variables

| Variable                                     | Required | Description                                                                |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_AMPLITUDE_API_KEY`           | Yes      | Amplitude project API key                                                  |
| `OSVA_CONNECTOR_AMPLITUDE_SECRET_KEY`        | Yes      | Amplitude project secret key                                               |
| `OSVA_CONNECTOR_AMPLITUDE_REGION`            | No       | `us` (default) or `eu`                                                     |
| `OSVA_CONNECTOR_AMPLITUDE_TIMEOUT_MS`        | No       | Total deadline ms (default `30000`)                                        |
| `OSVA_CONNECTOR_AMPLITUDE_ALLOWED_CHART_IDS` | No       | Comma-separated chart ID allowlist (`unset` = any chart; empty = deny all) |

Credentials are never accepted through MCP tool arguments.

## Bounds

- Query dates must be `YYYYMMDD` with at most **90 days** inclusive lookback.
- Funnels accept at most **five** events.
- Segmentation accepts at most **two** `groupBy` properties.
- Event JSON in query parameters is validated and size-limited before encoding.

## Security

- Fixed Amplitude Dashboard hosts only in production.
- Bounded HTTP responses (2 MiB), one retry on 429/5xx with `Retry-After`.
- Optional saved-chart allowlist (same unset-vs-empty semantics as Qdrant collection allowlists).

## Output budget

Structured MCP output is capped at **256 KiB** UTF-8 on `JSON.stringify(result)`. Responses include `providerCalculated` labels and truncation metadata when lists are trimmed locally.

## MCP stdio

Binary: `osva-connector-amplitude` → `dist/stdio.js`.

```bash
pnpm --filter @osva-ai/connector-amplitude test
pnpm --filter @osva-ai/connector-amplitude build
```
