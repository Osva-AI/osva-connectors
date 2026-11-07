# `@osva-ai/connector-qdrant`

OSVA Connector Profile V1 MCP connector for [Qdrant](https://qdrant.tech): collection discovery, point reads, vector query, and gated upsert.

## Tools

| Tool                     | Access        | Description         |
| ------------------------ | ------------- | ------------------- |
| `qdrant.collection.list` | read          | List collections    |
| `qdrant.collection.get`  | read          | Collection metadata |
| `qdrant.point.get`       | read          | Points by ID        |
| `qdrant.point.scroll`    | read          | Scroll points       |
| `qdrant.point.query`     | read          | Dense vector query  |
| `qdrant.point.count`     | read          | Point count         |
| `qdrant.point.upsert`    | write (gated) | Upsert points       |

## Configuration

See [docs/INSTALL-QDRANT.md](../../docs/INSTALL-QDRANT.md).

## Development

```bash
pnpm --filter @osva-ai/connector-qdrant test
pnpm --filter @osva-ai/connector-qdrant build
```
