# @osva-ai/connector-salesforce

Bounded Salesforce CRM MCP connector (nine tools): account and contact reads, opportunity reads, opportunity stage listing, optional stage updates, and optional task creation.

## Tools

| Tool                                | Kind                             |
| ----------------------------------- | -------------------------------- |
| `salesforce.account.list`           | Read                             |
| `salesforce.account.get`            | Read                             |
| `salesforce.contact.list`           | Read                             |
| `salesforce.contact.get`            | Read                             |
| `salesforce.opportunity.list`       | Read (optional allowlist filter) |
| `salesforce.opportunity.get`        | Read                             |
| `salesforce.opportunity.stage.list` | Read                             |
| `salesforce.opportunity.stage.set`  | Mutation (gated)                 |
| `salesforce.task.create`            | Mutation (gated)                 |

## Configuration

| Variable                                          | Required      | Default                             |
| ------------------------------------------------- | ------------- | ----------------------------------- |
| `OSVA_CONNECTOR_SALESFORCE_INSTANCE_URL`          | Yes           | —                                   |
| `OSVA_CONNECTOR_SALESFORCE_ACCESS_TOKEN`          | Yes           | —                                   |
| `OSVA_CONNECTOR_SALESFORCE_API_VERSION`           | No            | `v59.0`                             |
| `OSVA_CONNECTOR_SALESFORCE_ALLOWED_RESOURCE_IDS`  | For mutations | —                                   |
| `OSVA_CONNECTOR_SALESFORCE_ALLOWED_TARGET_STAGES` | No            | all stage names accepted when unset |
| `OSVA_CONNECTOR_SALESFORCE_STAGE_UPDATES_ENABLED` | No            | `false`                             |
| `OSVA_CONNECTOR_SALESFORCE_TASKS_ENABLED`         | No            | `false`                             |
| `OSVA_CONNECTOR_SALESFORCE_HOST_WRITES_APPROVED`  | No            | `false`                             |
| `OSVA_CONNECTOR_SALESFORCE_INCLUDE_PII`           | No            | `false`                             |
| `OSVA_CONNECTOR_SALESFORCE_ALLOW_TEST_API_HOST`   | No            | `false`                             |
| `OSVA_CONNECTOR_SALESFORCE_TIMEOUT_MS`            | No            | `30000`                             |

SOQL is built only from fixed templates in `soql-builder.ts` (pagination limits/offsets). User input cannot supply arbitrary queries.

## Run (stdio)

```bash
osva-connector-salesforce
```

## Development

```bash
pnpm --filter @osva-ai/connector-salesforce build
pnpm --filter @osva-ai/connector-salesforce test
```
