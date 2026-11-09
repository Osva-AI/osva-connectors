# Install `@osva-ai/connector-snowflake`

**Node.js 24+** · `@osva-ai/connector-sdk@1.1.4`

**Source-only in B4.9** — not yet on npm. Validate with `pnpm test:package-acceptance:snowflake`.

## Purpose

Read-only Snowflake metadata and bounded `SELECT` queries (eight MCP tools). Fixed database, role, and warehouse; server-built SQL only.

## Tools

`snowflake.database.get`, `snowflake.schema.list`, `snowflake.schema.get`, `snowflake.table.list`, `snowflake.table.get`, `snowflake.table.columns.list`, `snowflake.table.rows.sample`, `snowflake.table.aggregate`

## Authentication

Configure a **read-only Snowflake role** with minimal `SELECT` on allowed schemas/tables. Prefer key-pair or OAuth token auth supported by the official Node driver. Password auth is supported for development only.

## Required configuration

| Variable                                  | Description                        |
| ----------------------------------------- | ---------------------------------- |
| `OSVA_CONNECTOR_SNOWFLAKE_ACCOUNT`        | Account identifier                 |
| `OSVA_CONNECTOR_SNOWFLAKE_USER`           | User                               |
| `OSVA_CONNECTOR_SNOWFLAKE_ROLE`           | Read-only role                     |
| `OSVA_CONNECTOR_SNOWFLAKE_WAREHOUSE`      | Fixed warehouse                    |
| `OSVA_CONNECTOR_SNOWFLAKE_DATABASE`       | Single database                    |
| `OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_TABLES` | JSON: `schema → table → columns[]` |

## Optional

| Variable                                         | Description                              |
| ------------------------------------------------ | ---------------------------------------- |
| `OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_SCHEMAS`       | Comma-separated schema allowlist         |
| `OSVA_CONNECTOR_SNOWFLAKE_QUERY_TIMEOUT_SECONDS` | Default 30, max 120                      |
| `OSVA_CONNECTOR_SNOWFLAKE_PASSWORD`              | Driver password when not using key/OAuth |

## Cost controls

Snowflake has no per-query dollar cap in the driver. Use warehouse resource monitors, statement timeouts, and row limits. `LIMIT` does not guarantee cheap scans.

## MCP host

```json
{
  "mcpServers": {
    "osva-snowflake": {
      "command": "osva-connector-snowflake",
      "env": {
        "OSVA_CONNECTOR_SNOWFLAKE_ACCOUNT": "xy12345.us-east-1",
        "OSVA_CONNECTOR_SNOWFLAKE_USER": "OSVA_READER",
        "OSVA_CONNECTOR_SNOWFLAKE_ROLE": "OSVA_READ",
        "OSVA_CONNECTOR_SNOWFLAKE_WAREHOUSE": "OSVA_WH",
        "OSVA_CONNECTOR_SNOWFLAKE_DATABASE": "ANALYTICS",
        "OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_TABLES": "{\"PUBLIC\":{\"ORDERS\":[\"ORDER_ID\",\"STATUS\"]}}"
      }
    }
  }
}
```

See [packages/snowflake/README.md](../packages/snowflake/README.md) and [RELEASE-CHECKLIST-SNOWFLAKE.md](./RELEASE-CHECKLIST-SNOWFLAKE.md).
