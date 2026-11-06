# @osva-ai/connector-google-calendar

OSVA Connector Profile V1 **Google Calendar** MCP connector (stdio): **calendar discovery**, bounded **event reads**, **free/busy**, and **event mutations** when explicitly enabled and host-approved.

Target first public npm version **`0.1.0`** — **not published yet**; use `pnpm test:package-acceptance:google-calendar` or `pnpm pack` before release.

## Capabilities

| Tool                      | Purpose                                 |
| ------------------------- | --------------------------------------- |
| `calendar.calendar.list`  | Calendar list (`calendarList.list`)     |
| `calendar.event.list`     | Events (`events.list`)                  |
| `calendar.event.get`      | Single event (`events.get`)             |
| `calendar.freebusy.query` | Free/busy (`freeBusy`)                  |
| `calendar.event.create`   | Create event (`events.insert`) — gated  |
| `calendar.event.update`   | Partial update (`events.patch`) — gated |
| `calendar.event.delete`   | Delete (`events.delete`) — gated        |

Default configuration is **read-oriented**. Mutations require `OSVA_CONNECTOR_GOOGLE_CALENDAR_WRITE_ENABLED`, `OSVA_CONNECTOR_GOOGLE_CALENDAR_HOST_MUTATIONS_APPROVED`, and `OSVA_CONNECTOR_GOOGLE_CALENDAR_ALLOWED_CALENDAR_IDS`.

- **Unset** (env var absent): **no calendar allowlist** — all calendar ids the credential can access are allowed for read tools (subject to Google API permissions).
- **Set to a non-empty comma-separated list**: read tools only expose/use those calendar ids (`calendar.calendar.list` filters to the list; other tools reject ids not on the list).
- **Set to an empty string** (or only commas/whitespace): **explicit deny-all** — no calendar id is permitted for `calendar.calendar.list`, `calendar.event.list`, `calendar.event.get`, `calendar.freebusy.query`, or mutations.

For **`calendar.freebusy.query`** and **`calendar.event.list`**, when both `timeMin` and `timeMax` are provided, **`timeMin` must be strictly before `timeMax`**.

## Google API

| API             | Host                                     |
| --------------- | ---------------------------------------- |
| Calendar API v3 | `https://www.googleapis.com/calendar/v3` |

## Time zones and recurrence

- Pass **RFC3339** `dateTime` bounds for queries; all-day events may use `date` in tool `event` objects (validated by Zod).
- **`calendar.event.list`**: set `singleEvents: true` and `orderBy: "startTime"` to expand recurring series into instances (provider semantics).
- **`calendar.event.update`**: uses **`PATCH`** (`events.patch`) for partial updates; recurrence changes follow Google Calendar behavior (including series vs instance).

## Authentication

Same pattern as other OSVA Google connectors:

- `OSVA_CONNECTOR_GOOGLE_CALENDAR_ACCESS_TOKEN` for host-managed OAuth access tokens, **or**
- ADC / service account via `GOOGLE_APPLICATION_CREDENTIALS`, **or**
- Optional **domain-wide delegation** with `OSVA_CONNECTOR_GOOGLE_CALENDAR_USE_DOMAIN_DELEGATION` + `OSVA_CONNECTOR_GOOGLE_CALENDAR_DELEGATED_USER_EMAIL`.

Mutations use HTTP methods **without automatic retry** on the client path (ambiguous outcomes surface as non-retryable `ConnectorSdkError`).

## MCP stdio

```bash
npx osva-connector-google-calendar
```

Programmatic use:

```ts
import {
  createGoogleCalendarConnector,
  createCalendarRestClient,
} from "@osva-ai/connector-google-calendar";
```

See [docs/INSTALL-GOOGLE-CALENDAR.md](../../docs/INSTALL-GOOGLE-CALENDAR.md).
