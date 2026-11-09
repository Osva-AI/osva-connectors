# @osva-ai/connector-bigquery

OSVA Connector Profile V1 MCP connector for **Google BigQuery** (read-only discovery and bounded queries).

## Tools (8)

| Tool                          | Access                                    |
| ----------------------------- | ----------------------------------------- |
| `bigquery.project.get`        | Read                                      |
| `bigquery.dataset.list`       | Read                                      |
| `bigquery.dataset.get`        | Read                                      |
| `bigquery.table.list`         | Read                                      |
| `bigquery.table.get`          | Read                                      |
| `bigquery.table.columns.list` | Read                                      |
| `bigquery.table.rows.sample`  | Read (structured filters, pagination)     |
| `bigquery.table.aggregate`    | Read (structured filters, max 2 group-by) |

## Configuration

| Variable                                   | Required | Description                                                                                                                                                                                                             |
| ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_BIGQUERY_PROJECT_ID`       | Yes      | GCP project id                                                                                                                                                                                                          |
| `OSVA_CONNECTOR_BIGQUERY_LOCATION`         | No       | Query/job location (default `US`)                                                                                                                                                                                       |
| `OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS` | No\*     | Comma-separated dataset ids. Unset = no metadata restriction; empty = deny all; required for data queries                                                                                                               |
| `OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES`   | No\*     | JSON map `dataset → table → columns[]`. Unset = no metadata restriction; empty object = deny all tables; empty column array = deny all columns. Required with non-empty columns for `rows.sample` and `table.aggregate` |
| `OSVA_CONNECTOR_BIGQUERY_MAX_BYTES_BILLED` | No       | Per-query `maximumBytesBilled` cap                                                                                                                                                                                      |
| `OSVA_CONNECTOR_BIGQUERY_QUERY_TIMEOUT_MS` | No       | Query job timeout (default 30s, max 120s)                                                                                                                                                                               |

Queries are built server-side from structured filters only (no raw SQL). Identifiers (datasets, tables, columns, aggregate aliases, `GROUP BY`) are validated against `[A-Za-z_][A-Za-z0-9_]*` and backtick-quoted; values are named parameters. Each query is authorized before any provider call, then dry-run before execution and capped by `maximumBytesBilled`.

\* **Data-query fail-closed (R1):** `bigquery.table.rows.sample` and `bigquery.table.aggregate` refuse to run unless both allowlists are explicitly configured and the requested dataset, table, metric columns, group-by columns, and filter columns are listed. A missing or empty column allowlist is not unrestricted access. Metadata tools (`dataset.list`, `table.get`, …) still treat an unset dataset/table allowlist as “no extra restriction.”

**Migration:** operators who previously sampled or aggregated without `OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS` / `OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES` must set those variables to the datasets/tables/columns the agent may read.
