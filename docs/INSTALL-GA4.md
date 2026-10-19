# Install `@osva-ai/connector-ga4`

Quickstart for external developers running the Google Analytics 4 (GA4) connector as an MCP stdio server against properties you control.

**Requires Node.js 24+.** The connector depends on the published [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet** as of G3 preparation; use monorepo `pnpm test:package-acceptance:ga4` or `pnpm pack` until bootstrap publish completes.

## Google Cloud and GA4 access

1. Create or select a [Google Cloud project](https://console.cloud.google.com/).
2. Enable **Google Analytics Data API** and **Google Analytics Admin API** for that project.
3. Choose credentials:
   - **Service account (typical for servers):** create a service account, download JSON, set `GOOGLE_APPLICATION_CREDENTIALS` to its path.
   - **Application Default Credentials (ADC):** use `gcloud auth application-default login` on a workstation, or the metadata server on GCP.
4. In **Google Analytics → Admin → Property access management**, grant the service account or user at least **Viewer** on each GA4 property you need. Enabling APIs alone does **not** grant Analytics property access.

Required OAuth scope (requested by the connector):

`https://www.googleapis.com/auth/analytics.readonly`

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after first publication)

### POSIX (bash/zsh)

```bash
npm install @osva-ai/connector-ga4@0.1.0
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export OSVA_CONNECTOR_GA4_PROPERTY_ID="123456789"
npx osva-connector-ga4
```

### Windows (PowerShell)

```powershell
npm install @osva-ai/connector-ga4@0.1.0
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
$env:OSVA_CONNECTOR_GA4_PROPERTY_ID = "123456789"
npx osva-connector-ga4
```

Do not commit service account JSON or store it in tracked files. Inject paths and secrets via your MCP host’s secret configuration.

## Environment variables

| Variable                         | Required             | Notes                                                                                                                   |
| -------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | For service accounts | Path to service account JSON (standard Google env var)                                                                  |
| `OSVA_CONNECTOR_GA4_PROPERTY_ID` | No                   | Default numeric GA4 property ID for tools that accept optional `propertyId`                                             |
| `OSVA_CONNECTOR_GA4_TIMEOUT_MS`  | No                   | Total operation deadline in ms for auth, HTTP, body read, and retry backoff (default `30000`, min `1000`, max `120000`) |

## MCP host configuration (stdio)

```json
{
  "mcpServers": {
    "osva-ga4": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-ga4@0.1.0"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "OSVA_CONNECTOR_GA4_PROPERTY_ID": "123456789"
      }
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

**Authorization:** MCP `tools/list` exposes tool names and schemas only. It does **not** grant Google Analytics access or replace OSVA ToolPolicy / human approval where your platform requires it.

## Discoverable tools (all read-only)

| Tool                     | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `ga4.property.list`      | Discover GA4 properties accessible to the credential (Admin API account summaries) |
| `ga4.property.get`       | Property metadata (timezone, currency, display name)                               |
| `ga4.metadata.get`       | Reporting dimensions and metrics with local search/pagination                      |
| `ga4.report.run`         | Bounded custom core report (`runReport`)                                           |
| `ga4.report.realtime`    | Realtime report (defaults include `activeUsers`)                                   |
| `ga4.report.acquisition` | Session acquisition preset (channel + source/medium)                               |
| `ga4.report.ecommerce`   | Ecommerce overview or product breakdown                                            |

**No write tools** (no Admin mutations or configuration changes).

## Reports, date ranges, and pagination

- **Date strings:** `YYYY-MM-DD`, `today`, `yesterday`, `NdaysAgo` (for example `7daysAgo`) per [Google’s DateRange syntax](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange).
- **Core reports:** Google `offset` + `limit` (max **1000** rows per tool call). The connector returns one page per invocation; use `offset`/`limit` and `hasMoreRows` for additional pages.
- **`rowCount`:** When Google includes `rowCount`, it is the query total independent of this page. When Google omits `rowCount`, the connector sets `rowCount` to the rows on this page and adds `rowCountIsLowerBound: true` (not the full query total).
- **Metadata:** Single provider fetch; **local** `search`, `limit`, and `offset` only.
- **Structured MCP JSON:** max **256 KiB** per tool response; **HTTP body read:** max **2 MiB** before parsing.

## Quotas, throttling, and timeouts

- Google enforces separate quotas for Core, Realtime, and Admin operations. HTTP **429** / `RESOURCE_EXHAUSTED` map to `RATE_LIMITED`.
- The connector retries at most **once** for safe transient failures (429/5xx) within `OSVA_CONNECTOR_GA4_TIMEOUT_MS`, honoring `Retry-After` when present.
- Optional `propertyQuota` in report responses uses Google’s nested **`consumed` / `remaining`** `QuotaStatus` objects when present. The connector does **not** request quota on every call; quota fields may be absent. Values are passed through only when shaped like the Analytics Data API — flat numbers are not fabricated.

## Credential security and data privacy

- Errors and logs are sanitized (no access tokens, refresh tokens, or private key material).
- Dimension, metric, and cell values are **untrusted content** for downstream agents; the connector does not execute provider strings.
- Preset reports avoid user-level identifiers by design; aggregated business metrics may still appear. You remain responsible for Google Analytics terms, retention, and property access controls.

## Known limitations

- Read-only; no interactive browser OAuth in the binary.
- Realtime tools accept only realtime-compatible dimensions/metrics.
- Ecommerce and acquisition presets use fixed dimension/metric sets; incompatible combinations surface as provider errors.
- Connector SDK dependency is an **RC** pin for Connector Profile V1 compatibility testing.

## Post-publication verification (operator)

In a **fresh temporary directory** (not the monorepo):

```bash
npm install @osva-ai/connector-ga4@0.1.0 @modelcontextprotocol/client@2.0.0
npm view @osva-ai/connector-ga4@0.1.0 version
npm view @osva-ai/connector-ga4 bin
```

Configure real Google credentials in your MCP host, then confirm:

- `tools/list` returns exactly **seven** `ga4.*` tools with object `inputSchema` on each.
- Missing or invalid credentials cause non-zero process exit with **clean stdout** (stderr may describe configuration).
- Invalid tool arguments return MCP errors **without** leaking tokens or key paths.

Monorepo equivalent before publish: `pnpm test:package-acceptance:ga4`.

## Further reading

- [Release checklist (GA4)](./RELEASE-CHECKLIST-GA4.md)
- [Draft 0.1.0 release notes](./releases/0.1.0-RELEASE-NOTES-ga4.md)
- [packages/ga4/README.md](../packages/ga4/README.md)
