# Install `@osva-ai/connector-notion`

**Node.js 24+.** SDK pin: `@osva-ai/connector-sdk@1.1.4`.

**Published:** `@osva-ai/connector-notion@0.1.0` on npm ([B3 publication record](./B3_PUBLICATION_RECORD.md)).

## Notion integration

1. Create an [internal integration](https://www.notion.so/my-integrations) with least-privilege capabilities for the pages/databases you need.
2. Share target pages or databases with the integration.
3. Copy the integration secret; supply it only via host secret storage → `OSVA_CONNECTOR_NOTION_ACCESS_TOKEN`.

Default API version: **`2026-03-11`** (`2025-09-03` also supported). Use data source IDs for `notion.datasource.query` (not database IDs).

## Environment

| Variable                                     | Required      | Description                             |
| -------------------------------------------- | ------------- | --------------------------------------- |
| `OSVA_CONNECTOR_NOTION_ACCESS_TOKEN`         | Yes           | Integration token                       |
| `OSVA_CONNECTOR_NOTION_API_VERSION`          | No            | Default `2026-03-11`                    |
| `OSVA_CONNECTOR_NOTION_WRITE_ENABLED`        | For mutations | `true`                                  |
| `OSVA_CONNECTOR_NOTION_HOST_WRITES_APPROVED` | For mutations | `true` after host approval              |
| `OSVA_CONNECTOR_NOTION_TIMEOUT_MS`           | No            | Default `30000`                         |
| `OSVA_CONNECTOR_NOTION_MAX_BLOCK_DEPTH`      | No            | Block normalization depth (default `2`) |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-notion": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-notion@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_NOTION_ACCESS_TOKEN": "${NOTION_TOKEN_FROM_HOST_VAULT}"
      }
    }
  }
}
```
