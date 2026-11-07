# `@osva-ai/connector-notion`

OSVA Connector Profile V1 **Notion** MCP connector (stdio): bounded **search**, **page/database/data source** reads, paginated **block children**, and controlled **page/block mutations** when explicitly enabled by the host.

## Tools

| Tool                           | Mode             |
| ------------------------------ | ---------------- |
| `notion.search`                | Read             |
| `notion.page.get`              | Read             |
| `notion.block.children.list`   | Read             |
| `notion.database.get`          | Read             |
| `notion.datasource.get`        | Read             |
| `notion.datasource.query`      | Read             |
| `notion.page.create`           | Mutating (gated) |
| `notion.page.update`           | Mutating (gated) |
| `notion.block.children.append` | Mutating (gated) |

**Database vs data source:** After API version `2025-09-03`, querying rows uses a **data source ID** (`notion.datasource.query`), not a database ID. Use `notion.database.get` to list `dataSources`.

## Environment

| Variable                                     | Description                                   |
| -------------------------------------------- | --------------------------------------------- |
| `OSVA_CONNECTOR_NOTION_ACCESS_TOKEN`         | Integration token (required)                  |
| `OSVA_CONNECTOR_NOTION_API_VERSION`          | Default `2026-03-11` (`2025-09-03` supported) |
| `OSVA_CONNECTOR_NOTION_WRITE_ENABLED`        | `true` to allow mutations                     |
| `OSVA_CONNECTOR_NOTION_HOST_WRITES_APPROVED` | `true` after host workflow approval           |
| `OSVA_CONNECTOR_NOTION_TIMEOUT_MS`           | Request deadline (default 30000)              |
| `OSVA_CONNECTOR_NOTION_MAX_BLOCK_DEPTH`      | Shallow block normalization depth (default 2) |

Mutating tools cannot be enabled via tool arguments.

## Security

- Tokens are redacted from mapped errors; never returned in tool output.
- Page text, properties, and block content are **untrusted**.
- Mutations perform no connector-level retries.

Install guide: [docs/INSTALL-NOTION.md](../../docs/INSTALL-NOTION.md)
