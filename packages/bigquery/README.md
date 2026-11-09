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

| Variable                                   | Required | Description                                             |
| ------------------------------------------ | -------- | ------------------------------------------------------- |
| `OSVA_CONNECTOR_BIGQUERY_PROJECT_ID`       | Yes      | GCP project id                                          |
| `OSVA_CONNECTOR_BIGQUERY_LOCATION`         | No       | Query/job location (default `US`)                       |
| `OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS` | No       | Comma-separated dataset ids (empty = deny all when set) |
| `OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES`   | No       | JSON map `dataset → table → columns[]`                  |
| `OSVA_CONNECTOR_BIGQUERY_MAX_BYTES_BILLED` | No       | Per-query `maximumBytesBilled` cap                      |
| `OSVA_CONNECTOR_BIGQUERY_QUERY_TIMEOUT_MS` | No       | Query job timeout (default 30s, max 120s)               |

Queries are built server-side from structured filters only (no raw SQL). Each query is dry-run before execution and capped by `maximumBytesBilled`.
