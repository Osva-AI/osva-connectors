# Install `@osva-ai/connector-onedrive`

**Node.js 24+.** SDK pin: `@osva-ai/connector-sdk@1.1.4`.

**Pre-publication:** `@osva-ai/connector-onedrive@0.1.0` is source-only in this repository until npm bootstrap (see [RELEASE-CHECKLIST-ONEDRIVE.md](./RELEASE-CHECKLIST-ONEDRIVE.md)).

## Microsoft Graph (delegated)

| Variable                               | Required | Description                                           |
| -------------------------------------- | -------- | ----------------------------------------------------- |
| `OSVA_CONNECTOR_ONEDRIVE_ACCESS_TOKEN` | **Yes**  | Delegated user OAuth access token for Microsoft Graph |

Typical **delegated** scopes:

| Operation                                    | Permission        |
| -------------------------------------------- | ----------------- |
| Drive / item reads, search, bounded download | `Files.Read`      |
| `onedrive.file.upload.small`                 | `Files.ReadWrite` |

The host supplies token lifecycle; no OAuth server in this package. Scope errors map to `UNAUTHORIZED` / `FORBIDDEN`.

## Optional policy

| Variable                                            | Description                                 |
| --------------------------------------------------- | ------------------------------------------- |
| `OSVA_CONNECTOR_ONEDRIVE_TIMEOUT_MS`                | HTTP timeout (default `30000`)              |
| `OSVA_CONNECTOR_ONEDRIVE_MAX_CONTENT_BYTES`         | Max download bytes (default `262144`)       |
| `OSVA_CONNECTOR_ONEDRIVE_ALLOWED_DRIVE_IDS`         | Tri-state drive allowlist                   |
| `OSVA_CONNECTOR_ONEDRIVE_ALLOWED_ROOT_ITEM_IDS`     | Tri-state folder-root allowlist             |
| `OSVA_CONNECTOR_ONEDRIVE_WRITE_ENABLED`             | Enable small file upload                    |
| `OSVA_CONNECTOR_ONEDRIVE_HOST_WRITES_APPROVED`      | Host write approval                         |
| `OSVA_CONNECTOR_ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS` | Upload folder allowlist when writes enabled |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-onedrive": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-onedrive@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_ONEDRIVE_ACCESS_TOKEN": "${GRAPH_DELEGATED_TOKEN_FROM_HOST_VAULT}"
      }
    }
  }
}
```
