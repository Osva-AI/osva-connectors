# @osva-ai/connector-mixpanel

OSVA Connector Profile V1 **read-only** MCP connector for [Mixpanel](https://mixpanel.com/) Query API analytics.

Target first public npm version **`0.1.0`**.

## Capabilities

Six MCP tools (all read-only):

| Tool                        | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `mixpanel.report.get`       | Saved Insights report (`GET /insights?bookmark_id`) |
| `mixpanel.segmentation.run` | Ad-hoc segmentation (`GET /segmentation`)           |
| `mixpanel.funnel.get`       | Saved funnel (`GET /funnels?funnel_id`)             |
| `mixpanel.retention.run`    | Ad-hoc retention (`GET /retention`)                 |
| `mixpanel.cohort.list`      | Cohort catalog (`POST /cohorts/list`)               |
| `mixpanel.event.top`        | Top events (`GET /events/top`)                      |

There is **no JQL** tool in v0.1.0.

## Mixpanel API

| Region         | Query API base                      |
| -------------- | ----------------------------------- |
| `us` (default) | `https://mixpanel.com/api/query`    |
| `eu`           | `https://eu.mixpanel.com/api/query` |
| `in`           | `https://in.mixpanel.com/api/query` |

The connector uses **HTTP Basic authentication** with a Mixpanel **service account** (username + secret). Credentials and project scope are fixed at process start from environment variables; they are **not** accepted through MCP tool arguments.

### Environment variables

| Variable                                           | Required | Description                                                      |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_USERNAME` | Yes      | Service account username                                         |
| `OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_SECRET`   | Yes      | Service account secret                                           |
| `OSVA_CONNECTOR_MIXPANEL_PROJECT_ID`               | Yes      | Positive integer project ID                                      |
| `OSVA_CONNECTOR_MIXPANEL_REGION`                   | No       | `us`, `eu`, or `in` (default `us`)                               |
| `OSVA_CONNECTOR_MIXPANEL_WORKSPACE_ID`             | No       | Optional workspace ID                                            |
| `OSVA_CONNECTOR_MIXPANEL_TIMEOUT_MS`               | No       | Request deadline ms (default `30000`)                            |
| `OSVA_CONNECTOR_MIXPANEL_ALLOWED_BOOKMARK_IDS`     | No       | Comma-separated bookmark allowlist ([Qdrant-style](#allowlists)) |
| `OSVA_CONNECTOR_MIXPANEL_ALLOWED_FUNNEL_IDS`       | No       | Comma-separated funnel allowlist                                 |

Grant the service account **read** access to the target project in Mixpanel project settings.

## Bounds

- **Lookback:** `fromDate` / `toDate` spans are capped at **90 days** on segmentation, retention, and saved funnel queries (all required for `mixpanel.funnel.get`).
- **Limits:** Tool inputs enforce maximum `limit` values (for example top events, cohort list, segmentation).
- **Event names:** Validated length and character set; newlines rejected.
- **`where` / `on`:** Optional Mixpanel filter expressions are length-bounded and **must not contain newlines**.

## Allowlists

`OSVA_CONNECTOR_MIXPANEL_ALLOWED_BOOKMARK_IDS` and `OSVA_CONNECTOR_MIXPANEL_ALLOWED_FUNNEL_IDS` follow the same semantics as Qdrant collection allowlists:

- **Unset** — no allowlist; all bookmark/funnel IDs permitted (subject to Mixpanel ACLs).
- **Empty string** — explicit deny-all for that resource type.
- **Comma-separated IDs** — only listed IDs may be used for `mixpanel.report.get` / `mixpanel.funnel.get`.

## Output budget

Structured MCP output is capped at **256 KiB** UTF-8 on `JSON.stringify(result)`.

## Security

- Fixed Mixpanel Query API hosts per region (no arbitrary endpoint overrides in production).
- Service account secrets are redacted from mapped error messages and Basic auth headers.
- Read-only Query API paths only; no export/write/JQL surfaces.
- Untrusted Mixpanel strings in responses are treated as data only.

## MCP stdio

```bash
npx @osva-ai/connector-mixpanel
```

Configure the environment variables above, then wire the binary as an MCP stdio server in your agent host.

## Development

```bash
pnpm --filter @osva-ai/connector-mixpanel build
pnpm --filter @osva-ai/connector-mixpanel test
```
