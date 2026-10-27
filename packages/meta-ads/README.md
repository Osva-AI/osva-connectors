# @osva-ai/connector-meta-ads

OSVA Connector Profile V1 **read-only** MCP connector for Meta (Facebook) Marketing API **v26.0**.

Target first public npm version **`0.1.0`** — see [docs/INSTALL-META-ADS.md](../../docs/INSTALL-META-ADS.md).

## Capabilities

Ten MCP tools:

| Tool                      | Purpose                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| `meta.adAccount.list`     | Discover ad accounts via `me/adaccounts` (allowlist filtered)       |
| `meta.adAccount.get`      | Ad account metadata (currency, timezone, status)                    |
| `meta.campaign.list`      | Campaign list with configured vs effective status                   |
| `meta.adSet.list`         | Ad sets with optional campaign filter and bounded targeting summary |
| `meta.ad.list`            | Ads with parent IDs and creative references                         |
| `meta.insights.account`   | Account-level Insights for a bounded date range                     |
| `meta.insights.campaign`  | Campaign-level Insights                                             |
| `meta.insights.adSet`     | Ad-set-level Insights                                               |
| `meta.insights.ad`        | Ad-level Insights                                                   |
| `meta.insights.breakdown` | Insights with validated breakdown dimensions                        |

## Meta Marketing API

| Host                 | Version | Methods                    |
| -------------------- | ------- | -------------------------- |
| `graph.facebook.com` | v26.0   | GET edges only (read-only) |

All requests use a fixed HTTPS host and version. The connector does **not** accept arbitrary Graph URLs or passthrough paths.

## Authentication

Configure a Meta **user** or **system user** access token with **`ads_read`** (and any additional permissions your Meta app requires for the endpoints you use).

| Variable                                   | Description                                        |
| ------------------------------------------ | -------------------------------------------------- |
| `OSVA_CONNECTOR_META_ADS_ACCESS_TOKEN`     | **Required.** Long-lived user or system user token |
| `OSVA_CONNECTOR_META_ADS_APP_SECRET`       | Optional. Enables `appsecret_proof` (HMAC-SHA256)  |
| `OSVA_CONNECTOR_META_ADS_ALLOWED_ACCOUNTS` | Optional comma-separated `act_` IDs                |
| `OSVA_CONNECTOR_META_ADS_TIMEOUT_MS`       | Total deadline ms (default `30000`)                |
| `OSVA_CONNECTOR_META_ADS_MAX_ROWS`         | Default row cap (default `100`, max `1000`)        |

Tokens are **never** accepted through MCP tool arguments. Authorization uses the `Authorization: Bearer` header (not query-string tokens in connector-built requests).

### Meta developer setup

1. Create a Meta developer app and add the **Marketing API** product.
2. Complete **App Review** and **Advanced Access** for `ads_read` where required.
3. Assign ad accounts to the app / system user in Business Manager.
4. Rotate tokens on a documented schedule; update the environment variable only.

## Insights and attribution

- **Spend** is returned as Meta **decimal strings** in **account currency** (`accountCurrency`). The connector does not treat spend as micros and does not compute ROAS.
- **actions** / **action_values** preserve `action_type` entries (for example `link_click`, `purchase`). There is no single universal conversion metric.
- Optional **`actionAttributionWindows`** and **`useUnifiedAttributionSetting`** map to documented Insights parameters when supplied.
- Conversion totals may **change retroactively** as attribution windows close; missing metrics remain `null`.

## Breakdowns (`meta.insights.breakdown`)

Supported dimensions: `age`, `gender`, `publisher_platform`, `platform_position`, `impression_device`. Incompatible combinations are rejected locally before calling Meta.

## Output and pagination

- Provider HTTP bodies capped at **2 MiB**; structured MCP JSON capped at **256 KiB** with truncation metadata.
- Pagination uses validated **`after`** cursors only; **`paging.next` URLs are never fetched**.

## MCP stdio

```json
{
  "mcpServers": {
    "osva-meta-ads": {
      "command": "node",
      "args": ["packages/meta-ads/dist/stdio.js"],
      "env": {
        "OSVA_CONNECTOR_META_ADS_ACCESS_TOKEN": "<token>",
        "OSVA_CONNECTOR_META_ADS_ALLOWED_ACCOUNTS": "act_1234567890"
      }
    }
  }
}
```

## Development

```bash
pnpm --filter @osva-ai/connector-meta-ads test
pnpm --filter @osva-ai/connector-meta-ads build
pnpm test:package-acceptance:meta-ads
```

## Known limitations (v0.1.0)

- No interactive OAuth onboarding or token persistence in the connector.
- Synchronous Insights only; long-running async report jobs are not exposed.
- Custom audiences and detailed targeting specs are intentionally omitted from outputs.
