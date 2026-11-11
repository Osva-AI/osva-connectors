# Install `@osva-ai/connector-supabase`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-supabase@0.1.1
npx osva-connector-supabase
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Purpose

Read-only Supabase **PostgREST** access (eight MCP tools). Honors RLS and user-scoped JWT identity. **Never** use the service-role or secret keys.

## Tools

`supabase.project.get`, `supabase.schema.list`, `supabase.table.list`, `supabase.table.get`, `supabase.table.columns.list`, `supabase.table.rows.list`, `supabase.table.row.get`, `supabase.table.rows.count`

## Credentials

| Key                    | Use                                                    |
| ---------------------- | ------------------------------------------------------ |
| Publishable (anon) key | API key header                                         |
| User access token      | Authenticated RLS identity (`Authorization: Bearer …`) |

The connector **rejects** `service_role` JWT claims and `sb_secret_*` keys. Renew user tokens outside the connector; no refresh storage in B4.9.

## Required configuration

| Variable                                    | Description                                     |
| ------------------------------------------- | ----------------------------------------------- |
| `OSVA_CONNECTOR_SUPABASE_PROJECT_URL`       | `https://<ref>.supabase.co`                     |
| `OSVA_CONNECTOR_SUPABASE_PUBLISHABLE_KEY`   | Publishable key                                 |
| `OSVA_CONNECTOR_SUPABASE_USER_ACCESS_TOKEN` | User JWT                                        |
| `OSVA_CONNECTOR_SUPABASE_ALLOWED_TABLES`    | JSON with `columns` and optional `lookupColumn` |

## Optional

| Variable                                      | Description                        |
| --------------------------------------------- | ---------------------------------- |
| `OSVA_CONNECTOR_SUPABASE_ALLOWED_SCHEMAS`     | Exposed schemas (default `public`) |
| `OSVA_CONNECTOR_SUPABASE_COUNT_EXACT_ENABLED` | Allow expensive exact counts       |
| `OSVA_CONNECTOR_SUPABASE_TIMEOUT_MS`          | HTTP timeout                       |

RLS and grants are configured by the Supabase project admin. Successful reads only mean the active token was permitted for those rows.

## MCP host

```json
{
  "mcpServers": {
    "osva-supabase": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-supabase@0.1.1"],
      "env": {
        "OSVA_CONNECTOR_SUPABASE_PROJECT_URL": "https://abcdefgh.supabase.co",
        "OSVA_CONNECTOR_SUPABASE_PUBLISHABLE_KEY": "eyJ...",
        "OSVA_CONNECTOR_SUPABASE_USER_ACCESS_TOKEN": "eyJ...",
        "OSVA_CONNECTOR_SUPABASE_ALLOWED_TABLES": "{\"public\":{\"profiles\":{\"columns\":[\"id\",\"display_name\"],\"lookupColumn\":\"id\"}}}"
      }
    }
  }
}
```

See [packages/supabase/README.md](../packages/supabase/README.md) and [RELEASE-CHECKLIST-SUPABASE.md](./RELEASE-CHECKLIST-SUPABASE.md).
