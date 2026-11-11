# Install `@osva-ai/connector-azure-blob`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-azure-blob@0.1.1
npx osva-connector-azure-blob
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Required configuration

| Variable                                 | Description          |
| ---------------------------------------- | -------------------- |
| `OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_NAME` | Storage account name |

Uses `@azure/identity` (`DefaultAzureCredential`) with `@azure/storage-blob`.

## Optional scope and write gates

- `OSVA_CONNECTOR_AZURE_BLOB_ALLOWED_CONTAINERS_READ` / `_WRITE`
- `OSVA_CONNECTOR_AZURE_BLOB_CREATE_ENABLED`, `OSVA_CONNECTOR_AZURE_BLOB_REPLACE_ENABLED`, `OSVA_CONNECTOR_AZURE_BLOB_HOST_WRITES_APPROVED`
- `OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_WIDE_CONTAINER_DISCOVERY`

## MCP host

```json
{
  "mcpServers": {
    "osva-azure-blob": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-azure-blob@0.1.1"],
      "env": {
        "OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_NAME": "myaccount"
      }
    }
  }
}
```

See [packages/azure-blob/README.md](../packages/azure-blob/README.md).
