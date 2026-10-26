# @osva-ai/connector-google-ads

OSVA Connector Profile V1 **read-only** MCP connector for Google Ads.

Target first public npm version **`0.1.0`** — see [docs/INSTALL-GOOGLE-ADS.md](../../docs/INSTALL-GOOGLE-ADS.md).

## Capabilities

Nine MCP tools:

| Tool                         | Purpose                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `ads.customer.list`          | Discover accessible customer IDs (`listAccessibleCustomers`)       |
| `ads.customer.get`           | Customer metadata (name, currency, timezone, manager flag, status) |
| `ads.campaign.list`          | Campaign list; optional date-bounded metric summary                |
| `ads.campaign.performance`   | Date-bounded campaign metrics                                      |
| `ads.adGroup.performance`    | Ad group metrics; optional `campaignId` filter                     |
| `ads.keyword.performance`    | Keyword metrics via `keyword_view`                                 |
| `ads.searchTerm.performance` | Search term metrics (subject to Google visibility rules)           |
| `ads.asset.performance`      | Asset metrics via `ad_group_ad_asset_view`                         |
| `ads.report.query`           | Structured allowlisted GAQL SELECT (not arbitrary query strings)   |

## Google Ads API

| Host                       | Version | Methods used                                            |
| -------------------------- | ------- | ------------------------------------------------------- |
| `googleads.googleapis.com` | v26     | `customers:listAccessibleCustomers`, `googleAds:search` |

Developer tokens are **optional** (legacy). New integrations after the September 2026 policy change rely on Google Cloud project API access levels.

## Authentication

Credential paths via [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs):

1. Application Default Credentials (authorized user or metadata)
2. Service account JSON via `GOOGLE_APPLICATION_CREDENTIALS`

OAuth scope: `https://www.googleapis.com/auth/adwords`

Google Ads does not expose separate read-only OAuth scopes; this connector exposes **no mutation tools**.

### Environment variables

| Variable                                      | Description                                 |
| --------------------------------------------- | ------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS`              | Service account key path                    |
| `OSVA_CONNECTOR_GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Manager (MCC) customer ID header            |
| `OSVA_CONNECTOR_GOOGLE_ADS_ALLOWED_CUSTOMERS` | Comma-separated 10-digit customer allowlist |
| `OSVA_CONNECTOR_GOOGLE_ADS_TIMEOUT_MS`        | Total deadline (default `30000`)            |
| `OSVA_CONNECTOR_GOOGLE_ADS_MAX_ROWS`          | Default GAQL row cap (default `100`)        |
| `OSVA_CONNECTOR_GOOGLE_ADS_DEVELOPER_TOKEN`   | Optional legacy developer token header      |

## GAQL safety (`ads.report.query`)

- SELECT-only queries constructed from allowlisted `resource`, `attributes`, `metrics`, and `segments.date`
- Allowlisted FROM resources: `customer`, `campaign`, `ad_group`, `ad_group_criterion`, `keyword_view`, `search_term_view`, `ad_group_ad_asset_view`
- Required bounded `startDate` / `endDate` with `segments.date` for performance resources
- Row and output size limits; no mutations, unions, or comments

## Reporting notes

- **Cost:** API reports `cost_micros`. The connector preserves micros; converted `cost` appears when `currencyCode` is supplied on performance tools or customer currency is known.
- **Missing metrics** remain `null` (not zero-filled).
- **Privacy:** search terms and low-volume keywords may be omitted by Google.

## MCP stdio

```json
{
  "mcpServers": {
    "osva-google-ads": {
      "command": "node",
      "args": ["packages/google-ads/dist/stdio.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json",
        "OSVA_CONNECTOR_GOOGLE_ADS_ALLOWED_CUSTOMERS": "1234567890"
      }
    }
  }
}
```

## Development

```bash
pnpm --filter @osva-ai/connector-google-ads test
pnpm --filter @osva-ai/connector-google-ads build
pnpm test:package-acceptance:google-ads
```
