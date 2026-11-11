# Install `@osva-ai/connector-gcs`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-gcs@0.1.1
npx osva-connector-gcs
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Required configuration

| Variable                        | Description             |
| ------------------------------- | ----------------------- |
| `OSVA_CONNECTOR_GCS_PROJECT_ID` | Google Cloud project id |

Uses Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS`.

## Optional scope and write gates

- `OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_READ` / `_WRITE`
- `OSVA_CONNECTOR_GCS_CREATE_ENABLED`, `OSVA_CONNECTOR_GCS_REPLACE_ENABLED`, `OSVA_CONNECTOR_GCS_HOST_WRITES_APPROVED`
- `OSVA_CONNECTOR_GCS_ACCOUNT_WIDE_BUCKET_DISCOVERY`

## MCP host

```json
{
  "mcpServers": {
    "osva-gcs": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-gcs@0.1.1"],
      "env": {
        "OSVA_CONNECTOR_GCS_PROJECT_ID": "my-project"
      }
    }
  }
}
```

See [packages/gcs/README.md](../packages/gcs/README.md).
