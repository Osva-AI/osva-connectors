# Install `@osva-ai/connector-hubspot`

Quickstart for running the HubSpot connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:hubspot` or `pnpm pack` until bootstrap publish.

## HubSpot access token

1. In HubSpot, create a **private app** with read scopes for CRM objects used by this connector (contacts, companies, deals, owners, pipelines as applicable).
2. Copy the **access token** (Bearer). API paths use version **2026-09** on `https://api.hubapi.com`.

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-hubspot@0.1.0
export OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN="pat-na1-your-token"
npx osva-connector-hubspot
```

## Environment variables

| Variable                                      | Required | Notes                                         |
| --------------------------------------------- | -------- | --------------------------------------------- |
| `OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN`         | Yes      | Private app access token (`Bearer`)           |
| `OSVA_CONNECTOR_HUBSPOT_TIMEOUT_MS`           | No       | Total deadline ms (default `30000`)           |
| `OSVA_CONNECTOR_HUBSPOT_MAX_ROWS`             | No       | Max list/search rows per tool (default `100`) |
| `OSVA_CONNECTOR_HUBSPOT_ALLOWED_OBJECT_TYPES` | No       | Default `contacts,companies,deals`            |
| `OSVA_CONNECTOR_HUBSPOT_INCLUDE_PII`          | No       | Default `false`                               |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-hubspot": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-hubspot@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN": "pat-na1-your-token"
      }
    }
  }
}
```

## Tool reference

See [packages/hubspot/README.md](../packages/hubspot/README.md).
