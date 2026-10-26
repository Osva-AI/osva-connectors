# @osva-ai/connector-google-sheets

OSVA Connector Profile V1 MCP connector for Google Sheets.

Target first public npm version **`0.1.0`** — **not published yet**; see [docs/INSTALL-GOOGLE-SHEETS.md](../../docs/INSTALL-GOOGLE-SHEETS.md).

## Capabilities

Eight MCP tools:

| Tool                        | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `sheets.spreadsheet.get`    | Spreadsheet metadata                             |
| `sheets.sheet.list`         | Tab list with grid metadata                      |
| `sheets.values.get`         | Read one A1 range (untrusted content)            |
| `sheets.values.batchGet`    | Read multiple ranges                             |
| `sheets.values.append`      | Append RAW rows (`INSERT_ROWS`; write guard)     |
| `sheets.values.update`      | Overwrite RAW range (write guard)                |
| `sheets.values.batchUpdate` | Multi-range RAW updates (write guard)            |
| `sheets.sheet.add`          | Add tab via `AddSheetRequest` only (write guard) |

## Google API

| API           | Host                       |
| ------------- | -------------------------- |
| Sheets API v4 | `sheets.googleapis.com/v4` |

## Authentication

Uses [`google-auth-library`](https://github.com/googleapis/google-auth-library-nodejs) Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`.

| Mode  | OAuth scope                                             |
| ----- | ------------------------------------------------------- |
| Read  | `https://www.googleapis.com/auth/spreadsheets.readonly` |
| Write | `https://www.googleapis.com/auth/spreadsheets`          |

Write scope is used only when `OSVA_CONNECTOR_GOOGLE_SHEETS_WRITE_ENABLED=true`.

### Environment variables

| Variable                                            | Required | Description                                   |
| --------------------------------------------------- | -------- | --------------------------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS`                    | For SA   | Path to service account JSON                  |
| `OSVA_CONNECTOR_GOOGLE_SHEETS_WRITE_ENABLED`        | No       | Default `false`; must be `true` for mutations |
| `OSVA_CONNECTOR_GOOGLE_SHEETS_TIMEOUT_MS`           | No       | Total deadline ms (default `30000`)           |
| `OSVA_CONNECTOR_GOOGLE_SHEETS_ALLOWED_SPREADSHEETS` | No       | Comma-separated spreadsheet ID allowlist      |

Enable **Google Sheets API** in your Google Cloud project.

## Writes and safety

- **RAW** `valueInputOption` only; append uses **INSERT_ROWS**.
- `sheets.values.batchUpdate` is the **values** batch API, not structural batch updates (except `sheets.sheet.add`, which sends a single `AddSheetRequest`).
- Mutations require explicit write enablement and honor the optional spreadsheet allowlist on every operation.
- Failed write responses use **ambiguous write** messaging (no automatic retries); verify the spreadsheet before retrying.

## Output budget

Structured MCP output is capped at **256 KiB** UTF-8 on `JSON.stringify(result)`. Large value matrices may include `valuesTruncated` / `valueRangesTruncated` metadata. HTTP responses are capped at **2 MiB**.

## Security

- Fixed Sheets API v4 paths only (test loopback host via injected client in tests).
- Credentials are never accepted through MCP tool arguments.
- Cell content from reads is **untrusted data**.

## MCP stdio

```bash
npx osva-connector-google-sheets
```

Programmatic use:

```ts
import {
  createGoogleSheetsConnector,
  createSheetsRestClient,
} from "@osva-ai/connector-google-sheets";
```

See [docs/INSTALL-GOOGLE-SHEETS.md](../../docs/INSTALL-GOOGLE-SHEETS.md) and [docs/RELEASE-CHECKLIST-GOOGLE-SHEETS.md](../../docs/RELEASE-CHECKLIST-GOOGLE-SHEETS.md).
