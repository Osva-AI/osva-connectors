# @osva-ai/connector-snowflake

OSVA Connector Profile V1 MCP connector for **Snowflake** (read-only catalog and bounded queries).

## Tools (8)

| Tool                           | Access                        |
| ------------------------------ | ----------------------------- |
| `snowflake.database.get`       | Read                          |
| `snowflake.schema.list`        | Read                          |
| `snowflake.schema.get`         | Read                          |
| `snowflake.table.list`         | Read                          |
| `snowflake.table.get`          | Read                          |
| `snowflake.table.columns.list` | Read                          |
| `snowflake.table.rows.sample`  | Read (server-built SELECT)    |
| `snowflake.table.aggregate`    | Read (structured aggregation) |

## Configuration

| Variable                                         | Required | Description                                            |
| ------------------------------------------------ | -------- | ------------------------------------------------------ |
| `OSVA_CONNECTOR_SNOWFLAKE_ACCOUNT`               | Yes      | Snowflake account identifier                           |
| `OSVA_CONNECTOR_SNOWFLAKE_USER`                  | Yes      | Username                                               |
| `OSVA_CONNECTOR_SNOWFLAKE_PASSWORD`              | Yes      | Password                                               |
| `OSVA_CONNECTOR_SNOWFLAKE_ROLE`                  | Yes      | Role                                                   |
| `OSVA_CONNECTOR_SNOWFLAKE_WAREHOUSE`             | Yes      | Warehouse                                              |
| `OSVA_CONNECTOR_SNOWFLAKE_DATABASE`              | Yes      | Database                                               |
| `OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_SCHEMAS`       | No       | Comma-separated schema allowlist                       |
| `OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_TABLES`        | No       | JSON map of schema → table names (empty object = none) |
| `OSVA_CONNECTOR_SNOWFLAKE_ALLOWED_COLUMNS`       | No       | JSON map of schema → table → column names              |
| `OSVA_CONNECTOR_SNOWFLAKE_QUERY_TIMEOUT_SECONDS` | No       | Default `30`, max `120`                                |

## Security

- Server-built `SELECT` only; identifiers are quoted from validated allowlists.
- Structured filters and aggregations (max **2** `GROUP BY` columns).
- Statement timeout, bounded rows, 256 KiB structured output budget, max **2** concurrent queries.
- Abort and timeout call snowflake-sdk `statement.cancel()` (driver 2.4.x). Cancellation is **requested** of Snowflake; fake-driver tests cannot prove the warehouse stopped billing. Results are consumed with `streamResult: true` and `streamRows({ start, end })` so the connector does not keep unbounded row arrays. Server-built SQL already includes `LIMIT`.
