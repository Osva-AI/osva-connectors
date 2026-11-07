# @osva-ai/connector-onedrive

OSVA Connector Profile V1 MCP connector for **Microsoft OneDrive** via delegated **Microsoft Graph v1.0**.

Target first public npm version **`0.1.0`** — **not published yet**.

## Capabilities

Six MCP tools:

| Tool                         | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `onedrive.drive.get`         | Default drive or specific drive metadata                   |
| `onedrive.item.list`         | Immediate folder children (one Graph page)                 |
| `onedrive.item.get`          | Item metadata                                              |
| `onedrive.file.read`         | Bounded UTF-8 text; binary files return metadata only      |
| `onedrive.file.search`       | Drive root search (`search(q='…')`)                        |
| `onedrive.file.upload.small` | Small PUT upload when writes are enabled and host-approved |

## Graph API

| API                  | Host                       |
| -------------------- | -------------------------- |
| Microsoft Graph v1.0 | `graph.microsoft.com/v1.0` |

## Authentication

**Delegated access token only** in v0.1.0:

| Variable                               | Required | Description                                                           |
| -------------------------------------- | -------- | --------------------------------------------------------------------- |
| `OSVA_CONNECTOR_ONEDRIVE_ACCESS_TOKEN` | Yes      | Bearer access token with Files.Read (and Files.ReadWrite for uploads) |

Credentials are never accepted through MCP tool arguments.

### Other environment variables

| Variable                                            | Required | Description                                         |
| --------------------------------------------------- | -------- | --------------------------------------------------- |
| `OSVA_CONNECTOR_ONEDRIVE_TIMEOUT_MS`                | No       | Total deadline ms (default `30000`)                 |
| `OSVA_CONNECTOR_ONEDRIVE_MAX_CONTENT_BYTES`         | No       | Max download bytes (default `262144`)               |
| `OSVA_CONNECTOR_ONEDRIVE_ALLOWED_DRIVE_IDS`         | No       | Tri-state drive allowlist (`/drives/{id}`)          |
| `OSVA_CONNECTOR_ONEDRIVE_ALLOWED_ROOT_ITEM_IDS`     | No       | Tri-state folder-root allowlist                     |
| `OSVA_CONNECTOR_ONEDRIVE_WRITE_ENABLED`             | No       | Enable `onedrive.file.upload.small` (default false) |
| `OSVA_CONNECTOR_ONEDRIVE_HOST_WRITES_APPROVED`      | No       | Host write approval gate (default false)            |
| `OSVA_CONNECTOR_ONEDRIVE_ALLOWED_UPLOAD_FOLDER_IDS` | No       | When set and writes enabled, must be non-empty      |

## Security

- Fixed Graph v1.0 paths only (test loopback via injected `graphApiHost`).
- Validated `@odata.nextLink` / client `nextLink`; no arbitrary URLs.
- Redirect responses are not followed (bearer is never sent to redirect targets).
- Upload file names reject path traversal.
- Retrieved file text is **untrusted data**.

## MCP stdio

```bash
npx osva-connector-onedrive
```

## Development

```bash
npm install
npm run typecheck
npm test
```
