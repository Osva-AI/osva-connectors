# Install `@osva-ai/connector-aws-s3`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** may remain on npm with an earlier SDK pin; prefer **`0.1.1`** for new installs.

## Install from npm

```bash
npm install @osva-ai/connector-aws-s3@0.1.1
npx osva-connector-aws-s3
```

Inject secrets via your MCP host configuration — do not commit credentials.

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
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-aws-s3@0.1.1"],
      "env": {
        "OSVA_CONNECTOR_S3_REGION": "us-east-1"
      }
    }
  }
}
```

See [packages/aws-s3/README.md](../packages/aws-s3/README.md) for the eight tools.
