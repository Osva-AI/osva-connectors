# @osva-ai/connector-pipedrive

OSVA Connector Profile V1 MCP connector for [Pipedrive CRM](https://developers.pipedrive.com/) (**API v2**).

## Capabilities

Ten MCP tools:

| Tool                                                          | Purpose                                        |
| ------------------------------------------------------------- | ---------------------------------------------- |
| `pipedrive.pipeline.list`                                     | Deal pipelines                                 |
| `pipedrive.stage.list`                                        | Pipeline stages (optional `pipelineId` filter) |
| `pipedrive.deal.list`                                         | Deals with cursor pagination                   |
| `pipedrive.deal.get`                                          | Single deal by ID                              |
| `pipedrive.deal.search`                                       | Deal search by term                            |
| `pipedrive.person.list`                                       | Persons with cursor pagination                 |
| `pipedrive.person.get`                                        | Single person by ID                            |
| `pipedrive.organization.list`                                 | Organizations                                  |
| `pipedrive.organization.get`                                  | Single organization by ID                      |
| `pipedrive.deal.stage.set` (input: `dealId`, `targetStageId`) | Move a deal to an allowlisted stage (gated)    |

Person contact fields and organization addresses are omitted unless `OSVA_CONNECTOR_PIPEDRIVE_INCLUDE_PII=true`.

## API

| Setting       | Value                                    |
| ------------- | ---------------------------------------- |
| Base URL      | `https://{company}.pipedrive.com/api/v2` |
| Authorization | `x-api-token: {API token}`               |

## Environment variables

| Variable                                            | Required | Description                                               |
| --------------------------------------------------- | -------- | --------------------------------------------------------- |
| `OSVA_CONNECTOR_PIPEDRIVE_COMPANY_DOMAIN`           | Yes      | Company subdomain (e.g. `acme`)                           |
| `OSVA_CONNECTOR_PIPEDRIVE_API_TOKEN`                | Yes      | Pipedrive API token                                       |
| `OSVA_CONNECTOR_PIPEDRIVE_API_BASE_URL`             | No       | Override base URL (tests); requires `ALLOW_TEST_API_HOST` |
| `OSVA_CONNECTOR_PIPEDRIVE_ALLOW_TEST_API_HOST`      | No       | `true` to permit local/custom API hosts                   |
| `OSVA_CONNECTOR_PIPEDRIVE_ALLOWED_RESOURCE_IDS`     | No       | Comma-separated deal IDs for gated reads/mutations        |
| `OSVA_CONNECTOR_PIPEDRIVE_ALLOWED_TARGET_STAGE_IDS` | No       | Comma-separated stage IDs permitted for `deal.stage.set`  |
| `OSVA_CONNECTOR_PIPEDRIVE_STAGE_ENABLED`            | No       | `false` by default; set `true` to allow stage updates     |
| `OSVA_CONNECTOR_PIPEDRIVE_HOST_WRITES_APPROVED`     | No       | `false` by default; host must approve mutations           |
| `OSVA_CONNECTOR_PIPEDRIVE_INCLUDE_PII`              | No       | `false` by default                                        |
| `OSVA_CONNECTOR_PIPEDRIVE_TIMEOUT_MS`               | No       | Request timeout (default `30000`)                         |

Credentials and write gates are never accepted through MCP tool arguments.

## Security

- Production API host pinned to `{domain}.pipedrive.com`.
- REST paths are allowlisted; redirects are not followed.
- Bounded HTTP responses (2 MiB); one retry on read-only 429/5xx.
- Deal stage updates require `STAGE_ENABLED`, `HOST_WRITES_APPROVED`, and a non-empty deal ID allowlist.

## MCP stdio

Binary: `osva-connector-pipedrive` → `dist/stdio.js`.

```bash
pnpm --filter @osva-ai/connector-pipedrive test
pnpm --filter @osva-ai/connector-pipedrive build
```
