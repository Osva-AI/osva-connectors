# `@osva-ai/connector-supabase`

Read-only Supabase MCP connector over **PostgREST** (not the PostgreSQL SQL connector).

## Tools (8)

- `supabase.project.get`
- `supabase.schema.list`
- `supabase.table.list`
- `supabase.table.get`
- `supabase.table.columns.list`
- `supabase.table.rows.list`
- `supabase.table.row.get`
- `supabase.table.rows.count`

## Configuration

| Variable                                      | Required          | Description                                                     |
| --------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| `OSVA_CONNECTOR_SUPABASE_PROJECT_URL`         | yes               | `https://<ref>.supabase.co`                                     |
| `OSVA_CONNECTOR_SUPABASE_PUBLISHABLE_KEY`     | yes               | Publishable / anon key (not `sb_secret_` or `service_role` JWT) |
| `OSVA_CONNECTOR_SUPABASE_USER_ACCESS_TOKEN`   | yes               | User JWT for RLS (not service role)                             |
| `OSVA_CONNECTOR_SUPABASE_ALLOWED_SCHEMAS`     | no                | Comma-separated schema allowlist                                |
| `OSVA_CONNECTOR_SUPABASE_ALLOWED_TABLES`      | yes for row tools | JSON map `schema → table → { columns, lookupColumn? }`          |
| `OSVA_CONNECTOR_SUPABASE_COUNT_EXACT_ENABLED` | no                | Default `false`; required for exact counts                      |
| `OSVA_CONNECTOR_SUPABASE_ALLOW_TEST_API_HOST` | no                | Allow `http://127.0.0.1` for local tests                        |
| `OSVA_CONNECTOR_SUPABASE_TIMEOUT_MS`          | no                | Request timeout (default 30000)                                 |

## Security

- HTTPS pinned origin (except explicit local test mode).
- No `select=*`; explicit column allowlists only.
- Structured PostgREST filters only (no raw filter strings).
- Exact counts gated by host env flag.

## Local dev

```bash
pnpm --filter @osva-ai/connector-supabase test
```
