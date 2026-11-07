# `@osva-ai/connector-pinecone`

OSVA Connector Profile V1 MCP connector for [Pinecone](https://www.pinecone.io): index control plane, data-plane reads, dense vector query, and gated upsert.

## Tools

| Tool                      | Access        | Description                         |
| ------------------------- | ------------- | ----------------------------------- |
| `pinecone.index.list`     | read          | List indexes                        |
| `pinecone.index.describe` | read          | Describe index (resolves data host) |
| `pinecone.index.stats`    | read          | Index statistics                    |
| `pinecone.vector.query`   | read          | Dense vector query                  |
| `pinecone.vector.fetch`   | read          | Fetch vectors by ID                 |
| `pinecone.vector.list`    | read          | List vector IDs                     |
| `pinecone.vector.upsert`  | write (gated) | Upsert dense vectors                |

Sparse and integrated-embedding indexes are rejected for query/upsert.

## Configuration

See [docs/INSTALL-PINECONE.md](../../docs/INSTALL-PINECONE.md).

## Development

```bash
pnpm --filter @osva-ai/connector-pinecone test
pnpm --filter @osva-ai/connector-pinecone build
```
