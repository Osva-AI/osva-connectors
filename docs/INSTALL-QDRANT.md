# Install `@osva-ai/connector-qdrant`

**Node.js 24+.** SDK pin: `@osva-ai/connector-sdk@1.1.4`.

## Qdrant cluster URL and API key

1. Provision a [Qdrant](https://qdrant.tech) cluster or local instance.
2. Set `OSVA_CONNECTOR_QDRANT_URL` (HTTPS in production; local HTTP only with `OSVA_CONNECTOR_QDRANT_ALLOW_LOCAL_HTTP=true`).
3. Set `OSVA_CONNECTOR_QDRANT_API_KEY` when your cluster requires the `api-key` header.

Agent tool inputs cannot change the Qdrant base URL.

## Environment

| Variable                                     | Required | Description                           |
| -------------------------------------------- | -------- | ------------------------------------- |
| `OSVA_CONNECTOR_QDRANT_URL`                  | Yes      | Qdrant REST base URL                  |
| `OSVA_CONNECTOR_QDRANT_API_KEY`              | No*      | Qdrant API key (`api-key` header)     |
| `OSVA_CONNECTOR_QDRANT_ALLOWED_COLLECTIONS`  | No       | Comma-separated collection allowlist  |
| `OSVA_CONNECTOR_QDRANT_ALLOW_LOCAL_HTTP`     | No       | `true` to trust localhost HTTP only   |
| `OSVA_CONNECTOR_QDRANT_WRITE_ENABLED`        | No       | `true` to allow `qdrant.point.upsert` |
| `OSVA_CONNECTOR_QDRANT_HOST_WRITES_APPROVED` | No       | Second write gate for upsert          |
| `OSVA_CONNECTOR_QDRANT_TIMEOUT_MS`           | No       | Default `30000` (1000–120000)         |

\*Required when the cluster enforces API keys.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-qdrant": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-qdrant@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_QDRANT_URL": "https://YOUR-CLUSTER.cloud.qdrant.io",
        "OSVA_CONNECTOR_QDRANT_API_KEY": "${QDRANT_API_KEY_FROM_HOST_VAULT}"
      }
    }
  }
}
```

Tool reference: **[packages/qdrant/README.md](../packages/qdrant/README.md)**.
