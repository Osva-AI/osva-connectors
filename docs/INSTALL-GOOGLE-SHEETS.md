# Install `@osva-ai/connector-google-sheets`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Google Cloud and Sheets access

1. Create or select a [Google Cloud project](https://console.cloud.google.com/).
2. Enable **Google Sheets API**.
3. Credentials:
   - **Service account:** download JSON, set `GOOGLE_APPLICATION_CREDENTIALS`.
   - **ADC:** `gcloud auth application-default login` or GCP metadata.
4. Share target spreadsheets with the service account email (Viewer for reads; Editor for writes).

OAuth scopes (selected by write enablement):

| Mode  | Scope                                                   |
| ----- | ------------------------------------------------------- |
| Read  | `https://www.googleapis.com/auth/spreadsheets.readonly` |
| Write | `https://www.googleapis.com/auth/spreadsheets`          |

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-google-sheets@0.1.0
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
npx osva-connector-google-sheets
```

## Environment variables

| Variable                                            | Required | Notes                                        |
| --------------------------------------------------- | -------- | -------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS`                    | For SA   | Path to JSON key                             |
| `OSVA_CONNECTOR_GOOGLE_SHEETS_WRITE_ENABLED`        | No       | Default `false`; set `true` for mutations    |
| `OSVA_CONNECTOR_GOOGLE_SHEETS_TIMEOUT_MS`           | No       | Total deadline ms (default `30000`)          |
| `OSVA_CONNECTOR_GOOGLE_SHEETS_ALLOWED_SPREADSHEETS` | No       | Optional comma-separated spreadsheet ID list |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-google-sheets": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-google-sheets@0.1.0"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "OSVA_CONNECTOR_GOOGLE_SHEETS_WRITE_ENABLED": "false"
      }
    }
  }
}
```

## Tools

| Tool                        | Purpose                    |
| --------------------------- | -------------------------- |
| `sheets.spreadsheet.get`    | Metadata                   |
| `sheets.sheet.list`         | Tabs                       |
| `sheets.values.get`         | Read range                 |
| `sheets.values.batchGet`    | Read multiple ranges       |
| `sheets.values.append`      | Append rows (write guard)  |
| `sheets.values.update`      | Overwrite range (write)    |
| `sheets.values.batchUpdate` | Multi-range update (write) |
| `sheets.sheet.add`          | Add tab (write)            |

See [packages/google-sheets/README.md](../packages/google-sheets/README.md) and [RELEASE-CHECKLIST-GOOGLE-SHEETS.md](./RELEASE-CHECKLIST-GOOGLE-SHEETS.md).
