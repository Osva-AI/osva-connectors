# @osva-ai/connector-postgres

PostgreSQL **read-only** connector for [OSVA Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md): connection health checks, **catalog discovery** (fixed SQL), and **bounded parameterized SELECT** queries (`postgres.query.read`).

**Not supported:** writes, credential exposure, or unbounded result dumps. Arbitrary SQL is **not** a complete sandbox—database grants, RLS, and PostgreSQL execution semantics remain authoritative.

## Configuration

| Variable                                     | Required | Default                                       | Description                                                                                                                                        |
| -------------------------------------------- | -------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_POSTGRES_URL`                | Yes      | —                                             | PostgreSQL connection URL. Never logged by the connector.                                                                                          |
| `OSVA_CONNECTOR_POSTGRES_SSL_MODE`           | No       | `disable` for local hosts; otherwise `verify` | `disable`, `require`, or `verify`.                                                                                                                 |
| `OSVA_CONNECTOR_POSTGRES_CONNECT_TIMEOUT_MS` | No       | `10000`                                       | Pool connection acquisition timeout (1000–60000).                                                                                                  |
| `OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS`   | No       | `30000`                                       | PostgreSQL `statement_timeout` at pool connect (1000–120000).                                                                                      |
| `OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS`   | No       | `45000`                                       | Wall-clock deadline for an entire `postgres.query.read` operation (5000–300000), including connect, transaction, cursor fetch/close, and rollback. |
| `OSVA_CONNECTOR_POSTGRES_POOL_MAX`           | No       | `2`                                           | Maximum pool size (1–10).                                                                                                                          |
| `OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS`    | No       | — (no allowlist)                              | Comma-separated schema allowlist (defense in depth; does **not** widen DB privileges).                                                             |

Invalid configuration fails at stdio startup with `CONFIGURATION_ERROR` without echoing secrets. An empty or malformed allowlist env value fails closed (no silent fallback to unrestricted discovery).

### Schema allowlist

When `OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS` is set (for example `app,analytics`):

- Discovery tools reject requests for schemas **not** in the list (`FORBIDDEN`).
- Fixed catalog SQL adds `nspname = ANY($allowlist)` in addition to PostgreSQL privilege checks.
- The allowlist never grants access the database role does not already have.

When unset, discovery returns only schemas/tables/columns visible to the connected role, excluding system namespaces (see below).

### Timeouts

- **Connection acquisition:** `connectionTimeoutMillis` on the pool (`OSVA_CONNECTOR_POSTGRES_CONNECT_TIMEOUT_MS`).
- **Per-statement execution:** PostgreSQL **`statement_timeout`** from `OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS` (SQLSTATE `57014` → connector `TIMEOUT`). Read queries also set transaction-local `statement_timeout` and **`lock_timeout`** (default **5s**).
- **Total operation deadline (`postgres.query.read`):** `OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS` bounds connect, transaction startup, every cursor fetch batch, cursor close, and rollback. Expiry → connector `TIMEOUT` with message _“PostgreSQL request exceeded the total operation deadline.”_ The connection is **destroyed** when the deadline or MCP cancellation leaves protocol state uncertain (not returned to the pool while work may still be running).
- **MCP cancellation:** `AbortSignal` is honored before pool acquisition, while waiting for a connection, and between cursor batches. Cancellation is **not** guaranteed to stop an in-flight PostgreSQL protocol operation instantly; uncertain clients are destroyed rather than reused.

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

### `postgres.query.read`

Runs **one** parameterized **SELECT** (including `WITH`, `UNION`, `VALUES`) inside an explicit **`BEGIN READ ONLY`** transaction on a single checked-out pool client, with transaction-local **`statement_timeout`** and **`lock_timeout`**, then **`ROLLBACK`**.

**Input**

| Field     | Type            | Default | Limits                                                               |
| --------- | --------------- | ------- | -------------------------------------------------------------------- |
| `sql`     | string          | —       | Required, max **8192** chars                                         |
| `params`  | array of scalar | `[]`    | Max **50** items (`string`, finite `number`, `boolean`, `null` only) |
| `maxRows` | integer         | `100`   | 1–**500**                                                            |

Use PostgreSQL placeholders **`$1`, `$2`, …** only. The connector never concatenates parameter values into SQL.

**Output**

| Field       | Description                                                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`   | Ordered `{ name, dataType }` (PostgreSQL-oriented type names)                                                                                                                      |
| `rows`      | **Positional** arrays aligned with `columns` (preserves duplicate column names)                                                                                                    |
| `rowCount`  | Rows returned after connector limits                                                                                                                                               |
| `truncated` | `true` when limited by `maxRows` or the structured JSON budget; `false` means no connector-level truncation was applied, not that the query represents a complete business dataset |
| `maxRows`   | Echo of the effective row cap for this call                                                                                                                                        |

**SQL admission (defense in depth)**

Parsed with **`pgsql-ast-parser`**. Permitted: a single top-level read query. Rejected examples: multiple statements, `INSERT`/`UPDATE`/`DELETE`, data-modifying CTEs, `SELECT INTO`, locking clauses (`FOR UPDATE` / `FOR SHARE` / `SKIP LOCKED`), and non-SELECT statement types.

Comment, dollar-quote, or trailing-semicolon tricks that yield multiple statements are rejected. This layer does **not** prove safety against all hostile PostgreSQL SQL (for example expensive or side-effecting functions in `SELECT` lists).

**Execution and timeouts**

1. Validate MCP input
2. Check MCP cancellation before acquiring a connection
3. `pool.connect()` (bounded by connect timeout)
4. `BEGIN READ ONLY` → `SET LOCAL statement_timeout` / `lock_timeout` → **`pg-cursor`** portal with bounded batch fetches (`rowMode: array`) → close cursor → `ROLLBACK` → `release()`
5. If cursor close, rollback, or connection state is uncertain, the client is **destroyed** (`release(true)`) instead of returned to the pool

No automatic retries. Optional **`executionEventSink`** on `createPostgresConnector` receives privacy-safe structured events (tool name, durations, row counts, truncation, timeout/cancellation category, pool counts)—never SQL, parameters, rows, URLs, or raw provider errors.

**Permissions, allowlist, and RLS**

- **`OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS` applies to discovery tools only.** It does **not** restrict table references inside `postgres.query.read` SQL. Query authorization relies on **database grants** (and RLS policies evaluated for the connected role).
- **`READ ONLY`** blocks ordinary writes to permanent relations but is **not** a substitute for revoking DML/DDL, restricting functions, or securing security-definer routines.
- **RLS** is enforced by PostgreSQL when enabled on tables the role can `SELECT`.
- Temporary objects and session effects are possible depending on SQL and role capabilities—treat the role as least-privilege.

**Result mapping**

Common PostgreSQL types are mapped to JSON-safe values: `null`, booleans, finite numbers, strings (per-cell cap **8192** chars), `bigint`/`numeric` as strings when needed, ISO timestamps, UUID strings, JSON/JSONB objects, bytea as base64, arrays recursively. Unsupported driver values → sanitized `PROVIDER_ERROR`. Max **256** columns per result.

**Result limits**

- Rows: `maxRows` (default 100, max **500**), enforced while fetching via cursor batches (fixed batch size **32**, plus a one-row lookahead when the row cap is reached)
- Structured MCP JSON: **256 KiB** total (`structuredContent`); a single row that alone exceeds the budget → `PROVIDER_ERROR` (not silently dropped)
- Connector memory stays bounded to returned rows plus at most one batch/lookahead fetch; PostgreSQL may still execute a large scan on the server (**not** a hard database execution-cost cap)

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
set OSVA_CONNECTOR_POSTGRES_WRITER_INTEGRATION_URL=postgresql://osva_writer:writer_pass@127.0.0.1:55432/osva_integration
pnpm --filter @osva-ai/connector-postgres test
```

Hermetic unit tests run without Docker. The integration suite runs when `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` is set (local) and on **GitHub Actions** via the `postgres-integration` CI job using the same Compose fixture.

**Supported versions (evidence):** hermetic tests target PostgreSQL **16** catalog shapes; optional integration uses `postgres:16-alpine`.

## Known limitations

- No cross-call snapshot consistency (discovery or ad-hoc SELECT)
- Mid-flight MCP cancel is bounded by `statement_timeout`, not instant cancel
- Discovery allowlist does not filter arbitrary SQL in `postgres.query.read`
- SQL admission + `READ ONLY` do not sandbox untrusted arbitrary SQL
- No pagination tokens for query results
- Very wide rows can still be expensive to serialize even within batch fetches

## License

Apache-2.0 — see repository [LICENSE](../../LICENSE).
