# Install `@osva-ai/connector-azure-blob`

**Node.js 24+** · `@osva-ai/connector-sdk@1.1.4`

Validate locally with `pnpm test:package-acceptance:azure-blob`.

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
      "command": "osva-connector-azure-blob",
      "env": {
        "OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_NAME": "myaccount"
      }
    }
  }
}
```

See [packages/azure-blob/README.md](../packages/azure-blob/README.md).
