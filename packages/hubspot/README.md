# @osva-ai/connector-hubspot

OSVA Connector Profile V1 **read-only** MCP connector for [HubSpot CRM](https://developers.hubspot.com/) (API version **2026-09**).

Target first public npm version **`0.1.0`** — **not published yet**; see [docs/INSTALL-HUBSPOT.md](../../docs/INSTALL-HUBSPOT.md).

## Capabilities

Ten MCP tools (all read-only):

| Tool                       | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `hubspot.contact.list`     | Contact list with cursor pagination (`GET /crm/objects/2026-09/contacts`) |
| `hubspot.contact.get`      | Single contact by ID                                                      |
| `hubspot.company.list`     | Company list                                                              |
| `hubspot.company.get`      | Single company by ID                                                      |
| `hubspot.deal.list`        | Deal list                                                                 |
| `hubspot.deal.get`         | Single deal by ID                                                         |
| `hubspot.crm.search`       | Structured CRM search (`POST .../search`)                                 |
| `hubspot.pipeline.list`    | Deal pipelines and stages                                                 |
| `hubspot.owner.list`       | CRM owners (PII minimized by default)                                     |
| `hubspot.association.list` | Record associations between CRM objects                                   |

CRM list/get/search tools request **allowlisted properties** only. Contact email, name, and phone fields are omitted unless `OSVA_CONNECTOR_HUBSPOT_INCLUDE_PII=true`.

## API

| Setting       | Value                               |
| ------------- | ----------------------------------- |
| Base URL      | `https://api.hubapi.com`            |
| API version   | `2026-09` (path segment)            |
| Authorization | `Bearer {private app access token}` |

## Environment variables

| Variable                                      | Required | Description                                                |
| --------------------------------------------- | -------- | ---------------------------------------------------------- |
| `OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN`         | Yes      | HubSpot private app access token                           |
| `OSVA_CONNECTOR_HUBSPOT_TIMEOUT_MS`           | No       | Total deadline ms (default `30000`)                        |
| `OSVA_CONNECTOR_HUBSPOT_MAX_ROWS`             | No       | Max rows per list/search tool (default `100`)              |
| `OSVA_CONNECTOR_HUBSPOT_ALLOWED_OBJECT_TYPES` | No       | Comma list: `contacts,companies,deals` (default all three) |
| `OSVA_CONNECTOR_HUBSPOT_INCLUDE_PII`          | No       | `false` by default; set `true` to include contact PII      |

Credentials are never accepted through MCP tool arguments.

## Security

- Fixed HubSpot API host only in production (`api.hubapi.com`).
- Bounded HTTP responses (2 MiB), one retry on 429/5xx with `Retry-After`.
- Pagination uses validated `after` cursors; provider `paging.next.link` hosts are checked (never followed directly).
- POST is used only for read-only CRM search.
- Search accepts structured `filterGroups` with allowlisted operators and properties — no raw JSON passthrough.

## v0.1.0 limitations

- Standard property allowlists only (no arbitrary custom property names in search filters).
- No OAuth, mutations, or write scopes.
- Search does not expose sorts or arbitrary HubSpot filter DSL strings.

## Output budget

Structured MCP output is capped at **256 KiB** UTF-8 on `JSON.stringify(result)`.

## MCP stdio

Binary: `osva-connector-hubspot` → `dist/stdio.js`.

```bash
pnpm --filter @osva-ai/connector-hubspot test
pnpm --filter @osva-ai/connector-hubspot build
```
