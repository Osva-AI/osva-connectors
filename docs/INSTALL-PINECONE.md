# Install `@osva-ai/connector-pinecone`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-pinecone@0.1.1
npx osva-connector-pinecone
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Pinecone API key

1. Create a [Pinecone](https://www.pinecone.io) project and API key.
2. Supply the key only via `OSVA_CONNECTOR_PINECONE_API_KEY`.

Control-plane calls use `https://api.pinecone.io` with `Api-Key` and `X-Pinecone-Api-Version: 2025-04`. Data-plane hosts are resolved from **describe index** responses only (never from tool input).

## Environment

| Variable                                       | Required | Description                              |
| ---------------------------------------------- | -------- | ---------------------------------------- |
| `OSVA_CONNECTOR_PINECONE_API_KEY`              | Yes      | Pinecone API key                         |
| `OSVA_CONNECTOR_PINECONE_ALLOWED_INDEXES`      | No       | Comma-separated index allowlist          |
| `OSVA_CONNECTOR_PINECONE_ALLOWED_NAMESPACES`   | No       | Comma-separated namespace allowlist      |
| `OSVA_CONNECTOR_PINECONE_WRITE_ENABLED`        | No       | `true` to allow `pinecone.vector.upsert` |
| `OSVA_CONNECTOR_PINECONE_HOST_WRITES_APPROVED` | No       | Second write gate for upsert             |
| `OSVA_CONNECTOR_PINECONE_TIMEOUT_MS`           | No       | Default `30000` (1000–120000)            |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-pinecone": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-pinecone@0.1.1"],
      "env": {
        "OSVA_CONNECTOR_PINECONE_API_KEY": "${PINECONE_API_KEY_FROM_HOST_VAULT}"
      }
    }
  }
}
```

Dense vector indexes only for query/upsert; sparse and integrated-embedding indexes are rejected with clear errors. `pinecone.vector.list` is **serverless indexes only** (Pinecone API 2025-04). Control/data plane calls use API version **2025-04** intentionally (not auto-upgraded to newer headers).

Tool reference: **[packages/pinecone/README.md](../packages/pinecone/README.md)**.
