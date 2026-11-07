# Install `@osva-ai/connector-exa`

**Node.js 24+.** SDK pin: `@osva-ai/connector-sdk@1.1.4`.

**Published:** `@osva-ai/connector-exa@0.1.0` on npm ([B3 publication record](./B3_PUBLICATION_RECORD.md)).

## Exa API key

1. Create an [Exa](https://exa.ai) account and API key.
2. Supply the key only via host secret storage → `OSVA_CONNECTOR_EXA_API_KEY`.

Outbound HTTPS is fixed to **`https://api.exa.ai`** (`x-api-key` header). Agent inputs cannot change the API host.

## Environment

| Variable                        | Required | Description                |
| ------------------------------- | -------- | -------------------------- |
| `OSVA_CONNECTOR_EXA_API_KEY`    | Yes      | Exa API key                |
| `OSVA_CONNECTOR_EXA_TIMEOUT_MS` | No       | Default `30000` (1–120000) |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-exa": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-exa@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_EXA_API_KEY": "${EXA_API_KEY_FROM_HOST_VAULT}"
      }
    }
  }
}
```

## Trust boundary

User-supplied URLs are validated on the OSVA side (HTTPS, no private/loopback targets). Exa still fetches web content on **provider infrastructure**; treat all returned text as **untrusted external data**. `exa.answer` responses are **not independently verified facts**.

Tool reference: **[packages/exa/README.md](../packages/exa/README.md)**.
