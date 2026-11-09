# @osva-ai/connector-azure-blob

OSVA Connector Profile V1 MCP connector for **Azure Blob Storage**.

## Tools (8)

| Tool                           | Access                            |
| ------------------------------ | --------------------------------- |
| `azureblob.container.list`     | Read                              |
| `azureblob.container.get`      | Read                              |
| `azureblob.blob.list`          | Read (prefix required)            |
| `azureblob.blob.metadata.get`  | Read                              |
| `azureblob.blob.text.read`     | Read (UTF-8 text, MIME allowlist) |
| `azureblob.blob.versions.list` | Read (prefix required)            |
| `azureblob.blob.text.create`   | Write (`If-None-Match: *`)        |
| `azureblob.blob.text.replace`  | Write (`If-Match` ETag)           |

## Configuration

| Variable                                 | Required | Description          |
| ---------------------------------------- | -------- | -------------------- |
| `OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_NAME` | Yes      | Storage account name |

Container/prefix allowlists and write gates use `OSVA_CONNECTOR_AZURE_BLOB_*` variables.
