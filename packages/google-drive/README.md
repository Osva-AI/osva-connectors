# @osva-ai/connector-google-drive

OSVA Connector Profile V1 **read-only** MCP connector for Google Drive.

Target first public npm version **`0.1.0`** — **not published yet**; see [docs/INSTALL-GOOGLE-DRIVE.md](../../docs/INSTALL-GOOGLE-DRIVE.md).

## Capabilities

Eight MCP tools (all read-only):

| Tool                     | Purpose                                                     |
| ------------------------ | ----------------------------------------------------------- |
| `drive.file.list`        | Bounded file search/list (`files.list`)                     |
| `drive.file.get`         | File metadata (`files.get`)                                 |
| `drive.file.read`        | UTF-8 text from stored text files (`alt=media`)             |
| `drive.file.export`      | Google Workspace export (text formats in structured output) |
| `drive.folder.list`      | Immediate folder children (non-recursive)                   |
| `drive.sharedDrive.list` | Shared drives (`drives.list`)                               |
| `drive.changes.start`    | Change tracking start token                                 |
| `drive.changes.list`     | One page of changes                                         |

## Google API

| API          | Host                          |
| ------------ | ----------------------------- |
| Drive API v3 | `www.googleapis.com/drive/v3` |

## Authentication

Uses [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs) Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`.

| Capability                                                  | OAuth scope                                      |
| ----------------------------------------------------------- | ------------------------------------------------ |
| All tools (metadata, media, export, shared drives, changes) | `https://www.googleapis.com/auth/drive.readonly` |

This is a **restricted** scope. Publicly distributed OAuth clients may require Google verification and additional security review.

Service accounts do not automatically see a user's My Drive; share files or folders with the service account, use shared drives, or configure domain-wide delegation (administrator-controlled).

Credentials are never accepted through MCP tool arguments.

### Environment variables

| Variable                                        | Required | Description                                                        |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------ |
| `GOOGLE_APPLICATION_CREDENTIALS`                | For SA   | Path to service account JSON                                       |
| `OSVA_CONNECTOR_GOOGLE_DRIVE_TIMEOUT_MS`        | No       | Total deadline ms (default `30000`)                                |
| `OSVA_CONNECTOR_GOOGLE_DRIVE_MAX_CONTENT_BYTES` | No       | Max bytes read from media/export (default `262144`, max `1048576`) |
| `OSVA_CONNECTOR_GOOGLE_DRIVE_ALLOWED_DRIVE_IDS` | No       | Comma-separated shared drive IDs (optional isolation mode)         |

Enable **Google Drive API** in your Google Cloud project.

## File content and export

- **Stored text:** `text/plain`, `text/csv`, `text/markdown`, `application/json` (UTF-8 only).
- **Workspace native types** use `drive.file.export` with documented format pairs.
- **Binary exports** (PDF, XLSX, PPTX, DOCX) return `UNSUPPORTED_FORMAT` in v0.1.0 (no MCP artifact channel).

Retrieved content is **untrusted data** — enforce workflow approval before using confidential document text in other systems.

## Shared drives and allowlist

When `OSVA_CONNECTOR_GOOGLE_DRIVE_ALLOWED_DRIVE_IDS` is set:

- Shared-drive-scoped tools require an allowed `driveId`.
- Direct file access checks metadata `driveId`; My Drive files are rejected.
- Allowlisting is **not** a complete boundary against cross-drive file IDs unless every access path is enforced.

## Output budget

Structured MCP output is capped at **256 KiB** UTF-8 on `JSON.stringify(result)`. Lists may include `*Truncated` metadata.

## Security

- Fixed Drive API v3 paths only (test loopback host via injected client only).
- No file mutations, no `acknowledgeAbuse`, no arbitrary URLs.
- No credential material in tool outputs.

## MCP stdio

```bash
npx osva-connector-google-drive
```

Programmatic use:

```ts
import {
  createGoogleDriveConnector,
  createDriveRestClient,
} from "@osva-ai/connector-google-drive";
```

See [docs/INSTALL-GOOGLE-DRIVE.md](../../docs/INSTALL-GOOGLE-DRIVE.md) and [docs/RELEASE-CHECKLIST-GOOGLE-DRIVE.md](../../docs/RELEASE-CHECKLIST-GOOGLE-DRIVE.md).
