# Install `@osva-ai/connector-salesforce`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Install from npm

```bash
npm install @osva-ai/connector-salesforce@0.1.0
npx osva-connector-salesforce
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Credentials

- Salesforce **OAuth access token** (Bearer) with REST API access to Account, Contact, Opportunity, Task, and OpportunityStage as needed.
- **Instance URL** from your org (for example `https://yourinstance.my.salesforce.com`).
- Optional pinned API version: `OSVA_CONNECTOR_SALESFORCE_API_VERSION` (default `v59.0`).

## Required environment

| Variable                                 | Required | Notes                      |
| ---------------------------------------- | -------- | -------------------------- |
| `OSVA_CONNECTOR_SALESFORCE_ACCESS_TOKEN` | Yes      | Bearer token               |
| `OSVA_CONNECTOR_SALESFORCE_INSTANCE_URL` | Yes      | HTTPS instance origin only |
| `OSVA_CONNECTOR_SALESFORCE_API_VERSION`  | No       | Default `v59.0`            |
| `OSVA_CONNECTOR_SALESFORCE_INCLUDE_PII`  | No       | Default `false`            |
| `OSVA_CONNECTOR_SALESFORCE_TIMEOUT_MS`   | No       | Default `30000`            |

## Mutation gates (default deny)

| Variable                                            | Default | Purpose                                        |
| --------------------------------------------------- | ------- | ---------------------------------------------- |
| `OSVA_CONNECTOR_SALESFORCE_STAGE_UPDATES_ENABLED`   | `false` | `salesforce.opportunity.stage.set`             |
| `OSVA_CONNECTOR_SALESFORCE_TASKS_ENABLED`           | `false` | `salesforce.task.create`                       |
| `OSVA_CONNECTOR_SALESFORCE_HOST_WRITES_APPROVED`    | `false` | Deployment write approval                      |
| `OSVA_CONNECTOR_SALESFORCE_ALLOWED_OPPORTUNITY_IDS` | empty   | Non-empty allowlist required for stage updates |
| `OSVA_CONNECTOR_SALESFORCE_ALLOWED_TASK_PARENT_IDS` | empty   | Non-empty allowlist required for tasks         |
| `OSVA_CONNECTOR_SALESFORCE_ALLOWED_TARGET_STAGES`   | unset   | Optional comma-separated stage names           |

## MCP stdio (from repo)

```json
{
  "mcpServers": {
    "osva-salesforce": {
      "command": "node",
      "args": ["path/to/osva-connectors/packages/salesforce/dist/stdio.js"],
      "env": {
        "OSVA_CONNECTOR_SALESFORCE_ACCESS_TOKEN": "<token>",
        "OSVA_CONNECTOR_SALESFORCE_INSTANCE_URL": "https://example.my.salesforce.com"
      }
    }
  }
}
```

Tool reference: [packages/salesforce/README.md](../packages/salesforce/README.md). Release checklist: [RELEASE-CHECKLIST-salesforce.md](./RELEASE-CHECKLIST-salesforce.md).
