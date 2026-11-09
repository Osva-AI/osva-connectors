# Install `@osva-ai/connector-gcs`

**Node.js 24+** · `@osva-ai/connector-sdk@1.1.4`

Validate locally with `pnpm test:package-acceptance:gcs`.

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
      "command": "osva-connector-gcs",
      "env": {
        "OSVA_CONNECTOR_GCS_PROJECT_ID": "my-project"
      }
    }
  }
}
```

See [packages/gcs/README.md](../packages/gcs/README.md).
