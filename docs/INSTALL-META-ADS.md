# Install `@osva-ai/connector-meta-ads`

Quickstart for running the Meta Ads connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:meta-ads` or `pnpm pack` until bootstrap publish.

## Meta developer app and Marketing API

1. Create an app at [developers.facebook.com](https://developers.facebook.com/) and add **Marketing API**.
2. Request **`ads_read`** (Standard or Advanced Access per Meta App Review requirements).
3. Assign the app and token principal to the ad accounts you need in **Meta Business Suite**.
4. Generate a **user access token** or **system user token** with `ads_read`.

Optional hardening: set `OSVA_CONNECTOR_META_ADS_APP_SECRET` so the connector sends **`appsecret_proof`** on Graph requests.

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-meta-ads@0.1.0
export OSVA_CONNECTOR_META_ADS_ACCESS_TOKEN="<long-lived-token>"
export OSVA_CONNECTOR_META_ADS_ALLOWED_ACCOUNTS="act_1234567890"
npx osva-connector-meta-ads
```

## Environment variables

| Variable                                   | Required | Notes                                       |
| ------------------------------------------ | -------- | ------------------------------------------- |
| `OSVA_CONNECTOR_META_ADS_ACCESS_TOKEN`     | Yes      | User or system user token with `ads_read`   |
| `OSVA_CONNECTOR_META_ADS_APP_SECRET`       | No       | App secret for `appsecret_proof`            |
| `OSVA_CONNECTOR_META_ADS_ALLOWED_ACCOUNTS` | No       | Comma-separated allowlist (`act_` optional) |
| `OSVA_CONNECTOR_META_ADS_TIMEOUT_MS`       | No       | Total deadline ms (default `30000`)         |
| `OSVA_CONNECTOR_META_ADS_MAX_ROWS`         | No       | Default row cap (default `100`, max `1000`) |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-meta-ads": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-meta-ads@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_META_ADS_ACCESS_TOKEN": "<token>",
        "OSVA_CONNECTOR_META_ADS_ALLOWED_ACCOUNTS": "act_1234567890"
      }
    }
  }
}
```

## Troubleshooting

- **190 / expired token:** rotate the access token and update the environment variable.
- **10 / permission errors:** verify `ads_read`, app mode (Live), and ad account assignments.
- **Empty Insights rows:** check date range, account spend, and breakdown compatibility.
- **Rate limits (codes 4, 17, 32, 613):** reduce concurrency; the connector retries eligible reads once within the deadline.

See [packages/meta-ads/README.md](../packages/meta-ads/README.md) for tool reference and reporting notes.
