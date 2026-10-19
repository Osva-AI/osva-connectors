# @osva-ai/connector-postgres

PostgreSQL **read-only** connector for [OSVA Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md): connection health checks and **catalog discovery** using fixed SQL only.

**Not supported:** arbitrary SQL, writes, credential exposure, or unbounded catalog dumps.

## Configuration

| Variable                                     | Required | Default                                       | Description                                                                            |
| -------------------------------------------- | -------- | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_POSTGRES_URL`                | Yes      | —                                             | PostgreSQL connection URL. Never logged by the connector.                              |
| `OSVA_CONNECTOR_POSTGRES_SSL_MODE`           | No       | `disable` for local hosts; otherwise `verify` | `disable`, `require`, or `verify`.                                                     |
| `OSVA_CONNECTOR_POSTGRES_CONNECT_TIMEOUT_MS` | No       | `10000`                                       | Pool connection acquisition timeout (1000–60000).                                      |
| `OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS`   | No       | `30000`                                       | PostgreSQL `statement_timeout` at pool connect (1000–120000).                          |
| `OSVA_CONNECTOR_POSTGRES_POOL_MAX`           | No       | `2`                                           | Maximum pool size (1–10).                                                              |
| `OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS`    | No       | — (no allowlist)                              | Comma-separated schema allowlist (defense in depth; does **not** widen DB privileges). |

Invalid configuration fails at stdio startup with `CONFIGURATION_ERROR` without echoing secrets. An empty or malformed allowlist env value fails closed (no silent fallback to unrestricted discovery).

### Schema allowlist

When `OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS` is set (for example `app,analytics`):

- Discovery tools reject requests for schemas **not** in the list (`FORBIDDEN`).
- Fixed catalog SQL adds `nspname = ANY($allowlist)` in addition to PostgreSQL privilege checks.
- The allowlist never grants access the database role does not already have.

When unset, discovery returns only schemas/tables/columns visible to the connected role, excluding system namespaces (see below).

### Timeouts

- **Connection acquisition:** `connectionTimeoutMillis` on the pool.
- **Query execution:** PostgreSQL **`statement_timeout`** from `OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS` (SQLSTATE `57014` → connector `TIMEOUT`).
- MCP **cancellation** is checked before/after queries; in-flight work is bounded by `statement_timeout`.

### TLS / SSL behavior

URL `sslmode` / `ssl` query parameters are **stripped**; `OSVA_CONNECTOR_POSTGRES_SSL_MODE` controls node-postgres `ssl`.

| Mode      | Behavior                                                           |
| --------- | ------------------------------------------------------------------ |
| `disable` | No TLS (typical local dev).                                        |
| `require` | TLS without certificate verification (**unsafe for production**).  |
| `verify`  | TLS with `rejectUnauthorized: true` (default for non-local hosts). |

Remote hosts are not silently downgraded to unverified TLS.

## Database permissions (primary enforcement)

Use a dedicated **least-privilege** role:

- `CONNECT` on the target database
- `USAGE` on approved schemas
- `SELECT` on relations agents should inspect (required for table/column discovery)
- No DML/DDL, no `SUPERUSER` / `BYPASSRLS`

Discovery lists only relations where the role has **`USAGE` on the schema** and **`SELECT` on the relation or at least one column** (table-level grant or any column-level `SELECT`). **`postgres.column.list`** lists only columns with column-level **`SELECT`** (`has_column_privilege`), so partial grants never expose unauthorized column names or types.

Objects in `pg_catalog`, `information_schema`, `pg_toast*`, and `pg_*` namespaces are excluded by fixed SQL filters.

**Materialized views** appear when the role has `SELECT` on the matview (same as tables/views).

**Partitioned tables** (`relkind = p`) are reported as `kind: "table"` (parent relation).

Catalog visibility is **not** a substitute for grants or RLS. Separate MCP calls are not a single consistent snapshot.

## MCP tools

### `postgres.connection.test`

Fixed health query: `SELECT version() AS server_version`.

**Input:** `{}`

**Output:** `{ ok: true, serverVersion }`

### `postgres.schema.list`

Lists accessible, non-system schemas (fixed `pg_namespace` query + `has_schema_privilege(..., 'USAGE')`).

**Input**

| Field    | Type    | Default | Limits       |
| -------- | ------- | ------- | ------------ |
| `limit`  | integer | `50`    | 1–100        |
| `cursor` | string  | —       | Opaque token |

**Output:** `{ schemas: [{ name }], nextCursor?, truncated? }`

### `postgres.table.list`

Lists relations in one schema when the role has `SELECT`.

**Input:** `schema` (required), optional `limit`, `cursor`

**Output:** `{ tables: [{ schema, name, kind }], nextCursor? }`

`kind`: `table` | `view` | `materialized_view` | `foreign_table` | `other`

### `postgres.column.list`

Lists columns for one table/view/matview (no defaults, comments, or generated expressions).

**Input:** `schema`, `table` (required), optional `limit`, `cursor`

**Output:** `{ columns: [{ name, dataType, nullable, ordinalPosition }], nextCursor? }`

## Pagination

- Keyset pagination (`ORDER BY` name / `attnum`, `LIMIT n+1`).
- Cursors are base64url JSON scoped to **schema list**, **(schema) table list**, or **(schema, table) column list**—tokens cannot be reused across a different schema or table.
- Malformed or mismatched cursors → `INVALID_INPUT`.
- Default page size **50**, maximum **100** per call.

## Output budgets

Structured MCP JSON (`structuredContent`) is capped at **256 KiB** per tool response (same principle as `@osva-ai/connector-github`).

- Schema/table/column names: max **128** characters (invalid/oversized provider values → `PROVIDER_ERROR`, identifiers are not silently truncated).
- `dataType` strings: max **256** characters.
- Duplicate JSON in MCP `content[].text` may exceed the structured budget; hosts should prefer structured content.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm --filter @osva-ai/connector-postgres build
pnpm --filter @osva-ai/connector-postgres test
```

### Optional real PostgreSQL integration test

```bash
docker compose -f packages/postgres/docker/integration-compose.yml up -d
set OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL=postgresql://osva_reader:reader_pass@127.0.0.1:55432/osva_integration
pnpm --filter @osva-ai/connector-postgres test
```

Hermetic unit tests run without Docker. The integration suite runs when `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` is set (local) and on **GitHub Actions** via the `postgres-integration` CI job using the same Compose fixture.

**Supported versions (evidence):** hermetic tests target PostgreSQL **16** catalog shapes; optional integration uses `postgres:16-alpine`.

## Known limitations

- Read-only discovery only—no data queries
- No cross-call snapshot consistency
- Mid-flight MCP cancel is bounded by `statement_timeout`, not instant cancel
- Connector allowlist is defense in depth; grants and RLS remain authoritative

## License

Apache-2.0 — see repository [LICENSE](../../LICENSE).
