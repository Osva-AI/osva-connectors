# Install `@osva-ai/connector-pipedrive`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Install from npm

```bash
npm install @osva-ai/connector-pipedrive@0.1.0
npx osva-connector-pipedrive
```

Inject secrets via your MCP host configuration — do not commit credentials.

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

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-pipedrive": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-pipedrive@0.1.0"]
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

See [packages/pipedrive/README.md](../packages/pipedrive/README.md) for tools and environment variables.
