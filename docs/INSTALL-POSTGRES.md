# Install `@osva-ai/connector-postgres`

Quickstart for external developers running the PostgreSQL connector as an MCP stdio server against a database you control.

**Requires Node.js 24+.** The connector depends on the published [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Supported PostgreSQL (evidence):** integration and packaged acceptance use **PostgreSQL 16** (`postgres:16-alpine`). Other major versions are not claimed until tested.

## Install from npm (after first publication)

Target first public version: **`0.1.0`**. The package is **not published yet** as of P0.6; use `pnpm pack` / tarball install for pre-release validation until bootstrap publish completes.

### POSIX (bash/zsh)

```bash
npm install @osva-ai/connector-postgres@0.1.0
export OSVA_CONNECTOR_POSTGRES_URL="postgresql://ROLE:PASSWORD@HOST:5432/DATABASE"
export OSVA_CONNECTOR_POSTGRES_SSL_MODE="verify"
npx osva-connector-postgres
```

### Windows (PowerShell)

```powershell
npm install @osva-ai/connector-postgres@0.1.0
$env:OSVA_CONNECTOR_POSTGRES_URL = "postgresql://ROLE:PASSWORD@HOST:5432/DATABASE"
$env:OSVA_CONNECTOR_POSTGRES_SSL_MODE = "verify"
npx osva-connector-postgres
```

Do not commit database passwords or store them in tracked `.env` files. Inject credentials via your MCP host’s secret configuration.

## Required environment variables

| Variable                           | Required | Notes                                                               |
| ---------------------------------- | -------- | ------------------------------------------------------------------- |
| `OSVA_CONNECTOR_POSTGRES_URL`      | Yes      | PostgreSQL URL. Never logged by the connector.                      |
| `OSVA_CONNECTOR_POSTGRES_SSL_MODE` | No       | `disable` (local), `require`, or `verify` (recommended for remote). |

Optional tuning (timeouts, pool size, schema allowlist): see [packages/postgres/README.md](../packages/postgres/README.md#configuration).

## TLS guidance

- Use **`verify`** for production hosts (`rejectUnauthorized: true`).
- **`require`** encrypts without certificate verification — unsafe for production.
- URL `sslmode` query parameters are **ignored**; set `OSVA_CONNECTOR_POSTGRES_SSL_MODE` explicitly.

## Least-privilege PostgreSQL role

Create a dedicated login role (example):

```sql
CREATE ROLE osva_agent LOGIN PASSWORD 'choose-a-strong-password';
GRANT CONNECT ON DATABASE your_db TO osva_agent;
GRANT USAGE ON SCHEMA app TO osva_agent;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO osva_agent;
-- Column-level grants when needed:
-- GRANT SELECT (col_a) ON app.partial_table TO osva_agent;
```

Do not grant `SUPERUSER`, `BYPASSRLS`, or broad DML/DDL. Row-level security policies remain authoritative.

Optional defense in depth for **discovery tools only**:

```bash
export OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS="app,analytics"
```

This does **not** restrict table references inside `postgres.query.read` SQL.

## MCP host configuration (stdio)

Example MCP client configuration (shape varies by host):

```json
{
  "mcpServers": {
    "osva-postgres": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-postgres@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_POSTGRES_URL": "postgresql://ROLE:PASSWORD@HOST:5432/DATABASE",
        "OSVA_CONNECTOR_POSTGRES_SSL_MODE": "verify",
        "OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS": "app"
      }
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"` instead of `npx`.

**Authorization:** MCP `tools/list` exposes tool names and schemas only. It does **not** replace database grants, OSVA ToolPolicy, or human approval.

## Discoverable tools (five)

| Tool                       | Mutating |
| -------------------------- | -------- |
| `postgres.connection.test` | No       |
| `postgres.schema.list`     | No       |
| `postgres.table.list`      | No       |
| `postgres.column.list`     | No       |
| `postgres.query.read`      | No       |

## Example read-only query

```json
{
  "name": "postgres.query.read",
  "arguments": {
    "sql": "SELECT id, email FROM app.users WHERE id = $1",
    "params": [1],
    "maxRows": 100
  }
}
```

Use **`$1`, `$2`, …** placeholders only. The connector does not concatenate parameter values into SQL.

## Output limits and truncation

- **`maxRows`:** default `100`, maximum **500** per call.
- **`truncated`:** `true` when row cap or the **256 KiB** structured JSON budget applies.
- Positional **`rows`** arrays align with **`columns`** (duplicate column names preserved).

Full semantics: [packages/postgres/README.md](../packages/postgres/README.md#postgresqueryread).

## Query and transaction deadlines

| Setting                                      | Default | Role                                            |
| -------------------------------------------- | ------- | ----------------------------------------------- |
| `OSVA_CONNECTOR_POSTGRES_QUERY_TIMEOUT_MS`   | 30000   | PostgreSQL `statement_timeout`                  |
| `OSVA_CONNECTOR_POSTGRES_TOTAL_TIMEOUT_MS`   | 45000   | Wall-clock cap for entire `postgres.query.read` |
| `OSVA_CONNECTOR_POSTGRES_CONNECT_TIMEOUT_MS` | 10000   | Pool connection acquisition                     |

MCP cancellation is honored between batches; in-flight PostgreSQL work may continue until `statement_timeout` or pool cleanup.

## Security assumptions

- Database **grants and RLS** are the primary authorization layer.
- SQL admission (`pgsql-ast-parser`) is defense in depth, not a sandbox.
- Discovery allowlist filters catalog tools, not arbitrary SQL in `postgres.query.read`.
- Query result rows are **sensitive provider content**; treat MCP payloads accordingly.
- Routine logs must not contain SQL, parameters, or connection strings (connector design goal).

## Known limitations

See [packages/postgres/README.md](../packages/postgres/README.md#known-limitations).
