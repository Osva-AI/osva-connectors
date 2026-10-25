# @osva-ai/connector-gsc

OSVA Connector Profile V1 **read-only** MCP connector for Google Search Console (GSC).

Target first public npm version **`0.1.0`** — **not published yet**; see [docs/INSTALL-GSC.md](../../docs/INSTALL-GSC.md).

## Capabilities

Eight MCP tools (all read-only):

| Tool                      | Purpose                                                  |
| ------------------------- | -------------------------------------------------------- |
| `gsc.property.list`       | Properties accessible to the credential (`sites.list`)   |
| `gsc.property.get`        | Property permission level (`sites.get`)                  |
| `gsc.performance.query`   | Bounded Search Analytics query (`searchanalytics.query`) |
| `gsc.performance.pages`   | Preset analytics by `page` dimension                     |
| `gsc.performance.queries` | Preset analytics by `query` dimension                    |
| `gsc.sitemap.list`        | Submitted sitemaps (`sitemaps.list`)                     |
| `gsc.sitemap.get`         | Sitemap status (`sitemaps.get`)                          |
| `gsc.url.inspect`         | URL Inspection read (`urlInspection.index:inspect`)      |

## Google APIs

| API                   | Host                               | Usage                             |
| --------------------- | ---------------------------------- | --------------------------------- |
| Webmasters API v3     | `www.googleapis.com/webmasters/v3` | Sites, Search Analytics, sitemaps |
| Search Console API v1 | `searchconsole.googleapis.com/v1`  | URL Inspection                    |

## Authentication

Uses [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs) Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON path).

| Capability                                    | OAuth scope                                           |
| --------------------------------------------- | ----------------------------------------------------- |
| Property list/get, Search Analytics, sitemaps | `https://www.googleapis.com/auth/webmasters.readonly` |
| URL Inspection                                | `https://www.googleapis.com/auth/webmasters`          |

URL Inspection uses the broader `webmasters` scope only for that API call. Other tools stay on `webmasters.readonly`.

Grant the service account or user access in **Search Console → Settings → Users and permissions** for each property.

### Environment variables

| Variable                         | Required             | Description                                                          |
| -------------------------------- | -------------------- | -------------------------------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | For service accounts | Path to service account JSON                                         |
| `OSVA_CONNECTOR_GSC_SITE_URL`    | No                   | Default property (`https://example.com/` or `sc-domain:example.com`) |
| `OSVA_CONNECTOR_GSC_TIMEOUT_MS`  | No                   | Total deadline ms (default `30000`, min `1000`, max `120000`)        |

Credentials are never accepted through MCP tool arguments.

Enable **Google Search Console API** in your Google Cloud project.

## Property identifiers

- **URL-prefix:** `https://example.com/` (http/https, no credentials in URL)
- **Domain:** `sc-domain:example.com`

## Search Analytics semantics

- Returns **top rows** only; pagination via `startRow` / `rowLimit` (max **500** per MCP call) does not guarantee full export.
- Query rows may omit **anonymized** queries.
- **CTR** is a ratio in `[0, 1]` from Google.
- **Position** is an average.
- Recent dates may be incomplete; use optional `dataState` where supported.

Each analytics tool response includes a `reportingNotes` object documenting these limits.

## Output budget

Structured MCP output is capped at **256 KiB** UTF-8 on `JSON.stringify(result)`. Long provider strings are truncated with `*Truncated` metadata where applicable.

## Security

- Fixed Google API hosts only (no arbitrary endpoint overrides in production).
- No sitemap URL fetching over user-controlled HTTP from the connector.
- No mutation tools in v0.1.0.
- Untrusted Search Console strings are treated as data only.

## MCP stdio

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

Binary: `osva-connector-gsc` → `dist/stdio.js`.

## License

Apache-2.0
