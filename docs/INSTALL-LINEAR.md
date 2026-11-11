# Install `@osva-ai/connector-linear`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-linear@0.1.1
npx osva-connector-linear
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Linear credentials

Use one of:

- **Personal API key** → `OSVA_CONNECTOR_LINEAR_API_KEY` (sent as the raw `Authorization` header value).
- **OAuth access token** from the host → `OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN` (sent as `Bearer …`).

This connector does not implement an OAuth login server.

## Environment

| Variable                                        | Required         | Description                                      |
| ----------------------------------------------- | ---------------- | ------------------------------------------------ |
| `OSVA_CONNECTOR_LINEAR_API_KEY`                 | One of key/token | Personal API key                                 |
| `OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN`            | One of key/token | OAuth access token                               |
| `OSVA_CONNECTOR_LINEAR_WRITE_ENABLED`           | For mutations    | `true`                                           |
| `OSVA_CONNECTOR_LINEAR_HOST_MUTATIONS_APPROVED` | For mutations    | `true` after host approval                       |
| `OSVA_CONNECTOR_LINEAR_ALLOWED_TEAM_IDS`        | No               | Comma-separated team IDs for mutation guardrails |
| `OSVA_CONNECTOR_LINEAR_TIMEOUT_MS`              | No               | Default `30000`                                  |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-linear": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-linear@0.1.1"],
      "env": {
        "OSVA_CONNECTOR_LINEAR_API_KEY": "${LINEAR_API_KEY_FROM_HOST_VAULT}"
      }
    }
  }
}
```
