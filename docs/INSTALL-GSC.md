# Install `@osva-ai/connector-gsc`

Quickstart for running the Google Search Console (GSC) connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:gsc` or `pnpm pack` until bootstrap publish.

## Google Cloud and Search Console access

1. Create or select a [Google Cloud project](https://console.cloud.google.com/).
2. Enable **Google Search Console API**.
3. Credentials:
   - **Service account:** download JSON, set `GOOGLE_APPLICATION_CREDENTIALS`.
   - **ADC:** `gcloud auth application-default login` or GCP metadata.
4. In **Search Console → Settings → Users and permissions**, grant the principal access to each property (Full or Restricted as needed).

OAuth scopes:

| Tools                                | Scope                                                 |
| ------------------------------------ | ----------------------------------------------------- |
| Property, Search Analytics, sitemaps | `https://www.googleapis.com/auth/webmasters.readonly` |
| URL Inspection                       | `https://www.googleapis.com/auth/webmasters`          |

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-gsc@0.1.0
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export OSVA_CONNECTOR_GSC_SITE_URL="https://example.com/"
npx osva-connector-gsc
```

## Environment variables

| Variable                         | Required         | Notes                                          |
| -------------------------------- | ---------------- | ---------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service accounts | Path to JSON key                               |
| `OSVA_CONNECTOR_GSC_SITE_URL`    | No               | Default `https://…/` or `sc-domain:…` property |
| `OSVA_CONNECTOR_GSC_TIMEOUT_MS`  | No               | Total deadline ms (default `30000`)            |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-gsc": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-gsc@0.1.0"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "OSVA_CONNECTOR_GSC_SITE_URL": "https://example.com/"
      }
    }
  }
}
```

## Tools (read-only)

| Tool                      | Purpose                         |
| ------------------------- | ------------------------------- |
| `gsc.property.list`       | Accessible properties           |
| `gsc.property.get`        | Property permission level       |
| `gsc.performance.query`   | Search Analytics query          |
| `gsc.performance.pages`   | Top pages preset                |
| `gsc.performance.queries` | Top queries preset              |
| `gsc.sitemap.list`        | Submitted sitemaps              |
| `gsc.sitemap.get`         | Sitemap diagnostics             |
| `gsc.url.inspect`         | Indexing inspection (read-only) |

## Search Analytics limits

- Max **500** rows per call (`rowLimit` / preset `limit`).
- Pagination via `startRow`; does not export the full dataset.
- Query rows may omit anonymized queries; CTR is a ratio; position is an average.

See [packages/gsc/README.md](../packages/gsc/README.md) and [RELEASE-CHECKLIST-GSC.md](./RELEASE-CHECKLIST-GSC.md).
