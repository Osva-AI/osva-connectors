# Install `@osva-ai/connector-zoho-crm`

**Node.js 24+** · [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk)

**Source-only** until B4 publication. Validate with `pnpm test:package-acceptance:zoho-crm`.

## Credentials

Zoho CRM **OAuth access token** and **data center region** (`us`, `eu`, `in`, `au`, `jp`, `ca`, `cn`, `sa` per current Zoho documentation). Header: `Authorization: Zoho-oauthtoken <token>`.

Record IDs are handled as strings end-to-end (never coerced to JavaScript `Number`).

## Environment

| Variable                               | Required | Notes                  |
| -------------------------------------- | -------- | ---------------------- |
| `OSVA_CONNECTOR_ZOHO_CRM_ACCESS_TOKEN` | Yes      | OAuth access token     |
| `OSVA_CONNECTOR_ZOHO_CRM_REGION`       | Yes      | API data-center region |
| `OSVA_CONNECTOR_ZOHO_CRM_INCLUDE_PII`  | No       | Default `false`        |
| `OSVA_CONNECTOR_ZOHO_CRM_TIMEOUT_MS`   | No       | Default `30000`        |

## Mutation gates

| Variable                                        | Default  | Purpose                          |
| ----------------------------------------------- | -------- | -------------------------------- |
| `OSVA_CONNECTOR_ZOHO_CRM_STAGE_UPDATES_ENABLED` | `false`  | `zoho.deal.stage.set`            |
| `OSVA_CONNECTOR_ZOHO_CRM_NOTES_ENABLED`         | `false`  | `zoho.deal.note.add`             |
| `OSVA_CONNECTOR_ZOHO_CRM_HOST_WRITES_APPROVED`  | `false`  | Deployment approval              |
| `OSVA_CONNECTOR_ZOHO_CRM_ALLOWED_DEAL_IDS`      | empty    | Required allowlist for mutations |
| `OSVA_CONNECTOR_ZOHO_CRM_ALLOWED_TARGET_STAGES` | optional | Permitted stage labels           |

`zoho.deal.note.add` always sends `"$is_shared_to_client": false`; that flag cannot be set from MCP input.

Tool reference: [packages/zoho-crm/README.md](../packages/zoho-crm/README.md). Release: [RELEASE-CHECKLIST-zoho-crm.md](./RELEASE-CHECKLIST-zoho-crm.md).
