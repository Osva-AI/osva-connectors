# @osva-ai/connector-postgres

PostgreSQL connector foundation for [OSVA Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md).

**P0.1 scope:** secure configuration, bounded connection pooling, lifecycle management, and a single health-check MCP tool. This package is **not** a general SQL connector yet.

## Configuration

| Variable                                     | Required | Default                                                             | Description                                                                                  |
| -------------------------------------------- | -------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_POSTGRES_URL`                | Yes      | —                                                                   | PostgreSQL connection URL (`postgresql://` or `postgres://`). Never logged by the connector. |
| `OSVA_CONNECTOR_POSTGRES_SSL_MODE`           | No       | `disable` for `localhost` / `127.0.0.1` / `::1`; otherwise `verify` | One of `disable`, `require`, `verify`.                                                       |
| `OSVA_CONNECTOR_POSTGRES_CONNECT_TIMEOUT_MS` | No       | `10000`                                                             | Pool connection acquisition timeout (1000–60000).                                            |
| `OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS`   | No       | `30000`                                                             | PostgreSQL `statement_timeout` (ms) applied at pool connect (1000–120000).                   |
| `OSVA_CONNECTOR_POSTGRES_POOL_MAX`           | No       | `2`                                                                 | Maximum pool size (1–10).                                                                    |

Configuration is validated at stdio startup. Malformed values fail with `CONFIGURATION_ERROR` without echoing secrets.

### Timeouts

- **Connection acquisition:** `connectionTimeoutMillis` on the node-postgres pool (`OSVA_CONNECTOR_POSTGRES_CONNECT_TIMEOUT_MS`).
- **Query execution:** PostgreSQL **`statement_timeout`** startup parameter set from `OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS`. The server cancels over-limit statements (SQLSTATE `57014`), so timed-out health checks do not keep running in the background while the pool holds the connection indefinitely.
- The connector does **not** use client-only `Promise.race` query deadlines. MCP `AbortSignal` cancellation is checked before/after the query; in-flight cancellation is bounded by `statement_timeout` (no separate cancel protocol in P0.1).

### TLS / SSL behavior

The connector **does not** combine URL `sslmode` / `ssl` query parameters with pool TLS options. Those parameters are stripped from the URL; `OSVA_CONNECTOR_POSTGRES_SSL_MODE` (or the host-based default) is the single source of truth for node-postgres `ssl`.

| Mode      | Behavior                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| `disable` | No TLS. Typical for local development against `localhost`.                                                      |
| `require` | TLS encryption **without** certificate verification. Use only when you explicitly accept MITM risk (local/dev). |
| `verify`  | TLS with `rejectUnauthorized: true` (default for non-local hosts). Use for remote/production databases.         |

Certificate verification is **not** silently disabled for remote hosts.

### Secure connection examples

**Local development (no TLS):**

```bash
export OSVA_CONNECTOR_POSTGRES_URL="postgresql://osva_reader@127.0.0.1:5432/app"
# SSL mode defaults to disable for 127.0.0.1
```

**Remote database (verified TLS):**

```bash
export OSVA_CONNECTOR_POSTGRES_URL="postgresql://osva_reader@db.example.com:5432/app"
export OSVA_CONNECTOR_POSTGRES_SSL_MODE="verify"
```

**Explicit dev-only TLS without verification (not for production):**

```bash
export OSVA_CONNECTOR_POSTGRES_SSL_MODE="require"
```

## Database permissions (primary enforcement)

Run the connector with a **dedicated, least-privilege** PostgreSQL role. Database grants are the primary security layer; connector-side read-only controls will be added in later milestones as defense in depth.

Recommended baseline for P0.1:

- `CONNECT` on the target database
- `USAGE` on approved schemas only
- `SELECT` on approved tables/views only (for future read tools)
- **No** `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, or DDL privileges
- **No** `SUPERUSER`, `CREATEDB`, `CREATEROLE`, or `BYPASSRLS`
- **No** access to sensitive schemas (`pg_catalog` beyond what health checks need, `information_schema`, etc.) unless explicitly required later

Example role (adjust names):

```sql
CREATE ROLE osva_reader LOGIN PASSWORD '…';
GRANT CONNECT ON DATABASE app TO osva_reader;
GRANT USAGE ON SCHEMA public TO osva_reader;
-- Future milestones: GRANT SELECT ON specific tables only.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```

### Row-level security (RLS)

If RLS policies apply to tables the role can access, query results reflect those policies. The connector does not bypass RLS. Service accounts used by agents should be scoped so RLS aligns with least privilege.

SQL parsing or MCP tool naming **does not** replace PostgreSQL privilege enforcement.

## MCP tools (P0.1)

### `postgres.connection.test`

Validates connectivity using a **fixed** SQL statement defined in connector code (`SELECT version() AS server_version`). The tool accepts **no** SQL input and performs no schema discovery.

**Input:** `{}` (no properties)

**Output:**

| Field           | Description                                    |
| --------------- | ---------------------------------------------- |
| `ok`            | Always `true` on success                       |
| `serverVersion` | PostgreSQL `version()` string (bounded length) |

Errors are normalized to stable `ConnectorSdkError` codes without stack traces, connection URLs, or credentials.

## Local development

From the monorepo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @osva-ai/connector-postgres build
pnpm --filter @osva-ai/connector-postgres test
```

Stdio binary (after build):

```bash
export OSVA_CONNECTOR_POSTGRES_URL="postgresql://…"
node packages/postgres/dist/stdio.js
```

## Known limitations (P0.1)

- Single tool only (`postgres.connection.test`); no arbitrary SQL, schema listing, or query execution
- No connector-side SQL allowlisting yet (planned with read tools)
- No automatic reconnection/backoff machinery
- Health check requires permission to execute `SELECT version()` (default for typical roles)

## Planned milestones

- Read-only schema discovery and bounded `SELECT` tools with defense-in-depth guards
- Output budgets for tabular results
- Optional Docker-based integration tests in CI

## License

Apache-2.0 — see repository [LICENSE](../../LICENSE).
