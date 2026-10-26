# Install `@osva-ai/connector-google-drive`

Quickstart for running the Google Drive connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:google-drive` or `pnpm pack` until bootstrap publish.

## Google Cloud and Drive access

1. Create or select a [Google Cloud project](https://console.cloud.google.com/).
2. Enable **Google Drive API**.
3. Credentials:
   - **Service account:** download JSON, set `GOOGLE_APPLICATION_CREDENTIALS`.
   - **ADC:** `gcloud auth application-default login` or GCP metadata.
4. Grant the principal access to files, folders, or shared drives (sharing or Workspace admin policies).

OAuth scope (single credential in v0.1.0):

| Tools                     | Scope                                            |
| ------------------------- | ------------------------------------------------ |
| All eight read-only tools | `https://www.googleapis.com/auth/drive.readonly` |

Restricted scope — public OAuth apps may require Google verification.

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-google-drive@0.1.0
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
npx osva-connector-google-drive
```

## Environment variables

| Variable                                        | Required         | Notes                               |
| ----------------------------------------------- | ---------------- | ----------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS`                | Service accounts | Path to JSON key                    |
| `OSVA_CONNECTOR_GOOGLE_DRIVE_TIMEOUT_MS`        | No               | Total deadline ms (default `30000`) |
| `OSVA_CONNECTOR_GOOGLE_DRIVE_MAX_CONTENT_BYTES` | No               | Media/export byte budget            |
| `OSVA_CONNECTOR_GOOGLE_DRIVE_ALLOWED_DRIVE_IDS` | No               | Optional shared-drive allowlist     |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-google-drive": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-google-drive@0.1.0"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

## Tools (read-only)

| Tool                     | Purpose                         |
| ------------------------ | ------------------------------- |
| `drive.file.list`        | Search/list files (one page)    |
| `drive.file.get`         | Metadata                        |
| `drive.file.read`        | Stored text files (UTF-8)       |
| `drive.file.export`      | Workspace export (text in JSON) |
| `drive.folder.list`      | Folder children                 |
| `drive.sharedDrive.list` | Shared drives                   |
| `drive.changes.start`    | Start change token              |
| `drive.changes.list`     | Change page                     |

See [packages/google-drive/README.md](../packages/google-drive/README.md) and [RELEASE-CHECKLIST-GOOGLE-DRIVE.md](./RELEASE-CHECKLIST-GOOGLE-DRIVE.md).
