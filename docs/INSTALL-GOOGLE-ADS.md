# Install `@osva-ai/connector-google-ads`

Quickstart for running the Google Ads connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:google-ads` or `pnpm pack` until bootstrap publish.

## Google Cloud and Google Ads access

1. Create or select a [Google Cloud project](https://console.cloud.google.com/).
2. Enable **Google Ads API** for the project.
3. Configure OAuth or service account credentials:
   - **Service account / ADC:** set `GOOGLE_APPLICATION_CREDENTIALS` or use Application Default Credentials.
   - **User ADC:** `gcloud auth application-default login` when your environment supports user credentials.
4. Grant the principal access to the Google Ads customer accounts you need (Standard or Admin access in Google Ads UI).

OAuth scope (read-only behavior is enforced by exposing no mutation tools):

| Tools          | Scope                                     |
| -------------- | ----------------------------------------- |
| All nine tools | `https://www.googleapis.com/auth/adwords` |

### Developer token (2026)

Google **removed the developer-token requirement** for new integrations effective **September 9, 2026**. This connector does **not** require a developer token. You may optionally set `OSVA_CONNECTOR_GOOGLE_ADS_DEVELOPER_TOKEN` for legacy compatibility if your organization still uses one.

Production access and quotas are governed by your Google Cloud project's **Google Ads API access level** (see [Google Ads API access levels](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)).

### Manager (MCC) accounts

When accessing client accounts through a manager, set:

`OSVA_CONNECTOR_GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the **manager** customer ID (10 digits, no dashes).

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-google-ads@0.1.0
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export OSVA_CONNECTOR_GOOGLE_ADS_ALLOWED_CUSTOMERS="1234567890"
npx osva-connector-google-ads
```

## Environment variables

| Variable                                      | Required | Notes                                            |
| --------------------------------------------- | -------- | ------------------------------------------------ |
| `GOOGLE_APPLICATION_CREDENTIALS`              | Often    | Service account JSON path                        |
| `OSVA_CONNECTOR_GOOGLE_ADS_LOGIN_CUSTOMER_ID` | No       | Manager account ID for MCC access                |
| `OSVA_CONNECTOR_GOOGLE_ADS_ALLOWED_CUSTOMERS` | No       | Comma-separated 10-digit customer ID allowlist   |
| `OSVA_CONNECTOR_GOOGLE_ADS_TIMEOUT_MS`        | No       | Total deadline ms (default `30000`)              |
| `OSVA_CONNECTOR_GOOGLE_ADS_MAX_ROWS`          | No       | Default GAQL row cap (default `100`, max `1000`) |
| `OSVA_CONNECTOR_GOOGLE_ADS_DEVELOPER_TOKEN`   | No       | Optional legacy developer token header           |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-google-ads": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-google-ads@0.1.0"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/credentials.json",
        "OSVA_CONNECTOR_GOOGLE_ADS_ALLOWED_CUSTOMERS": "1234567890"
      }
    }
  }
}
```

## Troubleshooting

- **403 / PERMISSION_DENIED:** verify OAuth scope, customer access, and `login-customer-id` for MCC setups.
- **Empty search terms or keywords:** Google Ads privacy thresholds may omit low-volume rows.
- **Costs:** API returns `cost_micros`; provide `currencyCode` on performance tools for labeled currency conversion.

See [packages/google-ads/README.md](../packages/google-ads/README.md) for tool reference and GAQL restrictions.
