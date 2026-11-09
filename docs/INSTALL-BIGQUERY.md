# Install `@osva-ai/connector-bigquery`

**Node.js 24+** · `@osva-ai/connector-sdk@1.1.4`

**Source-only in B4.9** — not yet on npm. Validate locally with `pnpm test:package-acceptance:bigquery`.

## Purpose

Read-only BigQuery discovery and bounded structured queries via eight MCP tools. No arbitrary SQL. Queries use dry-run estimates, `maximumBytesBilled`, and dataset/table/column allowlists.

## Tools

`bigquery.project.get`, `bigquery.dataset.list`, `bigquery.dataset.get`, `bigquery.table.list`, `bigquery.table.get`, `bigquery.table.columns.list`, `bigquery.table.rows.sample`, `bigquery.table.aggregate`

## Authentication

Prefer **Application Default Credentials**, workload identity federation, or an attached service account. Do not embed service-account JSON in MCP host env for production.

Required least-privilege IAM (indicative): `bigquery.datasets.get`, `bigquery.tables.get`, `bigquery.tables.list`, `bigquery.jobs.create`, `bigquery.jobs.get` scoped to allowed datasets.

## Required configuration

| Variable                                 | Description                         |
| ---------------------------------------- | ----------------------------------- |
| `OSVA_CONNECTOR_BIGQUERY_PROJECT_ID`     | Fixed GCP project (no MCP override) |
| `OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES` | JSON: `dataset → table → columns[]` |

## Optional configuration

| Variable                                   | Description                                   |
| ------------------------------------------ | --------------------------------------------- |
| `OSVA_CONNECTOR_BIGQUERY_LOCATION`         | Job location (default `US`)                   |
| `OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS` | Comma-separated dataset ids                   |
| `OSVA_CONNECTOR_BIGQUERY_MAX_BYTES_BILLED` | Positive byte cap (required for data queries) |
| `OSVA_CONNECTOR_BIGQUERY_QUERY_TIMEOUT_MS` | Default 30s, max 120s                         |

## Cost and limits

- Dry-run returns an **estimate** only; actual bytes billed may differ.
- Execution sets `maximumBytesBilled` from host configuration (callers cannot raise it).
- Job labels: `application=osva`, `connector=bigquery`.
- Result rows default 20, max 100; output JSON capped at 256 KiB.

## MCP host (Bash)

```json
{
  "mcpServers": {
    "osva-bigquery": {
      "command": "osva-connector-bigquery",
      "env": {
        "OSVA_CONNECTOR_BIGQUERY_PROJECT_ID": "my-project",
        "OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES": "{\"analytics\":{\"events\":[\"event_id\",\"event_type\"]}}",
        "OSVA_CONNECTOR_BIGQUERY_MAX_BYTES_BILLED": "1000000000"
      }
    }
  }
}
```

## MCP host (PowerShell)

Set env vars in the host profile, then point `command` at `osva-connector-bigquery.cmd` on Windows.

## Fake-provider verification

```powershell
pnpm --filter @osva-ai/connector-bigquery test
pnpm test:package-acceptance:bigquery
```

See [packages/bigquery/README.md](../packages/bigquery/README.md) and [RELEASE-CHECKLIST-BIGQUERY.md](./RELEASE-CHECKLIST-BIGQUERY.md).
