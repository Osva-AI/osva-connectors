# `@osva-ai/connector-confluence`

OSVA Connector Profile V1 **Confluence Cloud** MCP connector (stdio): bounded **space** and **page** reads, **CQL search**, paginated **child pages**, and controlled **page mutations** when explicitly enabled by the host.

## Tools

| Tool                            | Mode             |
| ------------------------------- | ---------------- |
| `confluence.space.list`         | Read             |
| `confluence.space.get`          | Read             |
| `confluence.page.list`          | Read             |
| `confluence.page.get`           | Read             |
| `confluence.search`             | Read             |
| `confluence.page.children.list` | Read             |
| `confluence.page.create`        | Mutating (gated) |
| `confluence.page.update`        | Mutating (gated) |

Page bodies use Confluence **storage** format via `bodyStorage` on writes and normalized `bodyStorage` on reads. The connector does not convert HTML.

## Environment

| Variable                                         | Description                                               |
| ------------------------------------------------ | --------------------------------------------------------- |
| `OSVA_CONNECTOR_CONFLUENCE_SITE_URL`             | `https://your-site.atlassian.net` (site auth modes)       |
| `OSVA_CONNECTOR_CONFLUENCE_CLOUD_ID`             | Atlassian cloud ID (OAuth gateway mode with access token) |
| `OSVA_CONNECTOR_CONFLUENCE_EMAIL`                | Atlassian account email (site basic auth with API token)  |
| `OSVA_CONNECTOR_CONFLUENCE_API_TOKEN`            | Atlassian API token (site basic auth)                     |
| `OSVA_CONNECTOR_CONFLUENCE_ACCESS_TOKEN`         | OAuth access token (site bearer or gateway)               |
| `OSVA_CONNECTOR_CONFLUENCE_WRITE_ENABLED`        | `true` to allow mutations                                 |
| `OSVA_CONNECTOR_CONFLUENCE_HOST_WRITES_APPROVED` | `true` after host workflow approval                       |
| `OSVA_CONNECTOR_CONFLUENCE_ALLOWED_SPACE_IDS`    | Tri-state space allowlist (see below)                     |
| `OSVA_CONNECTOR_CONFLUENCE_TIMEOUT_MS`           | Request deadline (default 30000)                          |

### Authentication

1. **Site + basic:** `SITE_URL` + `EMAIL` + `API_TOKEN` → `https://{site}/wiki/api/v2/`
2. **Site + bearer:** `SITE_URL` + `ACCESS_TOKEN`
3. **Gateway:** `CLOUD_ID` + `ACCESS_TOKEN` → `https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2/`

CQL search uses `.../wiki/rest/api/search` on the same host mode.

### Space allowlist (`OSVA_CONNECTOR_CONFLUENCE_ALLOWED_SPACE_IDS`)

- **Unset:** no connector-level space restriction on reads (API permissions still apply).
- **Non-empty comma-separated numeric space IDs:** reads, writes, and CQL are scoped to those spaces.
- **Explicit empty value** (`=` or whitespace-only): **deny-all** — list/search return empty sets; get/create/update are rejected.

### Pagination

List tools use Confluence v2 **cursor** pagination. The connector validates `_links.next` from the provider and only exposes a safe `nextCursor`; it never follows external pagination URLs.

### Page updates

`confluence.page.update` requires `versionNumber` for optimistic concurrency. Confluence returns **409** on version conflicts; the connector surfaces this as a non-retryable conflict error.

## Security

- Credentials are redacted from mapped errors; never returned in tool output.
- Page titles, bodies, and search excerpts are **untrusted**.
- Mutations perform no connector-level retries.
- Mutating tools cannot be enabled via tool arguments.
