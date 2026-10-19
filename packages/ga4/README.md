# @osva-ai/connector-ga4

OSVA Connector Profile V1 **read-only** MCP connector for Google Analytics 4 (GA4).

This package is developed in the [osva-connectors](https://github.com/Osva-AI/osva-connectors) monorepo. It is **not published to npm** as part of G1.

## Capabilities

Seven MCP tools:

| Tool                     | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `ga4.property.list`      | Discover GA4 properties accessible to the credential (Admin API account summaries) |
| `ga4.property.get`       | Property metadata (timezone, currency, display name)                               |
| `ga4.metadata.get`       | Reporting dimensions and metrics (`getMetadata`) with local search/pagination      |
| `ga4.report.run`         | Bounded custom core report (`runReport`)                                           |
| `ga4.report.realtime`    | Realtime report (`runRealtimeReport`, defaults to `activeUsers`)                   |
| `ga4.report.acquisition` | Session acquisition report (channel + source/medium)                               |
| `ga4.report.ecommerce`   | Ecommerce overview or product breakdown (separate query shapes)                    |

## Google APIs

| API                        | Host                            | Usage                                    |
| -------------------------- | ------------------------------- | ---------------------------------------- |
| Analytics Admin API v1beta | `analyticsadmin.googleapis.com` | Property discovery and property metadata |
| Analytics Data API v1beta  | `analyticsdata.googleapis.com`  | Metadata, core reports, realtime reports |

Universal Analytics Reporting API is **not** used.

## Authentication

Supported credential paths (via [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs)):

1. **Application Default Credentials (ADC)** — user credentials or metadata service on GCP.
2. **Service account** — set `GOOGLE_APPLICATION_CREDENTIALS` to the service account JSON key path.
3. **User-authorized ADC** — when your environment already holds user-refreshed ADC credentials.

Required OAuth scope:

`https://www.googleapis.com/auth/analytics.readonly`

### GA4 property access (important)

Creating a Google Cloud service account and enabling APIs does **not** grant Analytics property access. A Google Analytics administrator must grant the service account (or user) an appropriate role (for example **Viewer**) on each GA4 property in **Admin → Property access management**.

### Environment variables

| Variable                         | Required             | Description                                                                                                             |
| -------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | For service accounts | Path to service account JSON (standard Google env var)                                                                  |
| `OSVA_CONNECTOR_GA4_PROPERTY_ID` | No                   | Default numeric GA4 property ID for tools that accept optional `propertyId`                                             |
| `OSVA_CONNECTOR_GA4_TIMEOUT_MS`  | No                   | Total operation deadline in ms for auth, HTTP, body read, and retry backoff (default `30000`, min `1000`, max `120000`) |

Credentials are **never** accepted through MCP tool inputs. There is no interactive browser OAuth flow in G1.

Enable both **Google Analytics Data API** and **Google Analytics Admin API** in your Google Cloud project.

## MCP client configuration (stdio)

Local monorepo development:

```json
{
  "mcpServers": {
    "osva-ga4": {
      "command": "node",
      "args": ["packages/ga4/dist/stdio.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "OSVA_CONNECTOR_GA4_PROPERTY_ID": "123456789"
      }
    }
  }
}
```

After npm publication (future release):

```json
{
  "command": "npx",
  "args": ["-y", "@osva-ai/connector-ga4"],
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
  }
}
```

## Property IDs

GA4 property IDs are numeric (for example `123456789`). Tools accept either the bare ID or `properties/123456789`. Admin and Data API resource names use the `properties/{id}` form internally.

## Date ranges

Custom and preset reports accept GA4 date strings:

- `YYYY-MM-DD`
- `today`, `yesterday`
- `NdaysAgo` (for example `7daysAgo`)

Relative expressions follow [Google’s documented syntax](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange).

## Pagination and output limits

| Concern         | Behavior                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core reports    | Google `offset` + `limit` (max **1000** rows per tool call); includes `rowCount`, `rowsReturned`, and `hasMoreRows` when more provider rows exist |
| Property list   | Admin API `pageToken` pagination                                                                                                                  |
| Metadata        | Single provider fetch; **local** `search`, `limit`, and `offset` (not Google server-side metadata pagination)                                     |
| MCP JSON output | Max **256 KiB** serialized structured output per tool response                                                                                    |
| HTTP body read  | Max **2 MiB** raw response before parsing                                                                                                         |

The connector does not recursively fetch additional report pages within one tool call.

## Quotas and retries

Google enforces separate quotas for Core, Realtime, and Admin operations. The connector:

- Maps HTTP **429** and `RESOURCE_EXHAUSTED` to `RATE_LIMITED`
- Retries at most **once** for safe transient failures (429/5xx) within the configured deadline
- Honors `Retry-After` when present and within the deadline
- Does not retry authentication, permission, or validation failures

Quota fields in responses are passed through when present; they are **not guaranteed** on every call.

## Security and privacy

- Provider dimensions, metrics, and cell values are treated as **untrusted data** (prompt-injection safe handling is the MCP host’s responsibility; this connector does not execute provider strings).
- No user-level export, no configuration mutations, no arbitrary Google API method execution.
- Errors and logs are sanitized (no access tokens, refresh tokens, or private keys).
- Ecommerce and acquisition reports avoid user-level identifiers by design; business-sensitive aggregates may still appear.

## Known limitations

- G1 is read-only; no Admin write operations.
- No interactive OAuth onboarding in the connector binary.
- Realtime reports support only realtime-compatible dimensions/metrics.
- Ecommerce overview and product breakdown use fixed metric/dimension sets; incompatible combinations surface as provider errors.
- `totalRevenue` on acquisition preset is omitted when incompatible with the fixed dimension set (preset uses `keyEvents` instead of revenue on session-scoped dimensions).
