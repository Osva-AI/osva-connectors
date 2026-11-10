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

| Variable                                 | Required | Description                                                                                                                                                                               |
| ---------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_NAME` | Yes      | Storage account name                                                                                                                                                                      |
| `OSVA_CONNECTOR_AZURE_BLOB_TIMEOUT_MS`   | No       | Per-request client timeout budget via `AbortSignal.timeout` on Azure SDK calls (default 30s, max 120s). Cancels the in-flight HTTP request locally; does not roll back completed uploads. |

Container/prefix allowlists and write gates use `OSVA_CONNECTOR_AZURE_BLOB_*` variables.

Blob listing uses Azure `listBlobsFlat` prefix semantics: the requested prefix must equal an authorized prefix or be a descendant of one. Empty, ancestor, and sibling prefixes are denied when a container is scoped. `[]` is deny-all for that container; `[""]` allows the whole container. Unset allowlists remain unrestricted. Continuation markers are bound to container + prefix and are not raw Azure markers.
