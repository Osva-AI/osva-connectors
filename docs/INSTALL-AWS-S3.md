# Install `@osva-ai/connector-aws-s3`

**Node.js 24+** · `@osva-ai/connector-sdk@1.1.4`

Source-only until B4.8 npm publication. Validate locally with `pnpm test:package-acceptance:aws-s3`.

## Required configuration

| Variable                   | Description                  |
| -------------------------- | ---------------------------- |
| `OSVA_CONNECTOR_S3_REGION` | AWS region for the S3 client |

AWS credentials use the default SDK provider chain.

## Optional scope and write gates

- `OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ` / `_WRITE` — JSON map of bucket → prefix arrays
- `OSVA_CONNECTOR_S3_CREATE_ENABLED`, `OSVA_CONNECTOR_S3_REPLACE_ENABLED`, `OSVA_CONNECTOR_S3_HOST_WRITES_APPROVED`
- `OSVA_CONNECTOR_S3_ACCOUNT_WIDE_BUCKET_DISCOVERY` — list all buckets (default: allowlist only)

## MCP host

```json
{
  "mcpServers": {
    "osva-aws-s3": {
      "command": "osva-connector-aws-s3",
      "env": {
        "OSVA_CONNECTOR_S3_REGION": "us-east-1"
      }
    }
  }
}
```

See [packages/aws-s3/README.md](../packages/aws-s3/README.md) for the eight tools.
