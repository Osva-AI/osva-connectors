# Install `@osva-ai/connector-pipedrive`

**Node.js 24+** · [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk)

**Source-only** until B4 publication. Validate with `pnpm test:package-acceptance:pipedrive`.

## Credentials

Pipedrive **API token** and **company domain** (subdomain before `.pipedrive.com`). Authentication uses the `x-api-token` header only (no query-string tokens).

## Environment

| Variable                                  | Required | Notes                                               |
| ----------------------------------------- | -------- | --------------------------------------------------- |
| `OSVA_CONNECTOR_PIPEDRIVE_API_TOKEN`      | Yes      | API token                                           |
| `OSVA_CONNECTOR_PIPEDRIVE_COMPANY_DOMAIN` | Yes      | Company subdomain                                   |
| `OSVA_CONNECTOR_PIPEDRIVE_INCLUDE_PII`    | No       | Default `false` (person/org contact fields omitted) |
| `OSVA_CONNECTOR_PIPEDRIVE_TIMEOUT_MS`     | No       | Default `30000`                                     |

## Mutation gates

| Variable                                         | Default  | Purpose                                        |
| ------------------------------------------------ | -------- | ---------------------------------------------- |
| `OSVA_CONNECTOR_PIPEDRIVE_STAGE_UPDATES_ENABLED` | `false`  | `pipedrive.deal.stage.set`                     |
| `OSVA_CONNECTOR_PIPEDRIVE_HOST_WRITES_APPROVED`  | `false`  | Deployment approval                            |
| `OSVA_CONNECTOR_PIPEDRIVE_ALLOWED_DEAL_IDS`      | empty    | Required non-empty allowlist for stage updates |
| `OSVA_CONNECTOR_PIPEDRIVE_ALLOWED_STAGE_IDS`     | optional | Permitted `targetStageId` values               |

Tool reference: [packages/pipedrive/README.md](../packages/pipedrive/README.md). Release: [RELEASE-CHECKLIST-pipedrive.md](./RELEASE-CHECKLIST-pipedrive.md).
