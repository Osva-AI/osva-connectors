# @osva-ai/connector-aws-s3

OSVA Connector Profile V1 MCP connector for **AWS S3** object storage.

## Tools (8)

| Tool                      | Access                            |
| ------------------------- | --------------------------------- |
| `s3.bucket.list`          | Read                              |
| `s3.bucket.get`           | Read                              |
| `s3.object.list`          | Read                              |
| `s3.object.metadata.get`  | Read                              |
| `s3.object.text.read`     | Read (UTF-8 text, MIME allowlist) |
| `s3.object.versions.list` | Read (version metadata)           |
| `s3.object.text.create`   | Write (`If-None-Match: *`)        |
| `s3.object.text.replace`  | Write (`If-Match` ETag)           |

## Configuration

| Variable                                          | Required | Description                                |
| ------------------------------------------------- | -------- | ------------------------------------------ |
| `OSVA_CONNECTOR_S3_REGION`                        | Yes      | AWS region for the S3 client               |
| `OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ`          | No       | JSON map `bucket → [prefixes]` for reads   |
| `OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_WRITE`         | No       | JSON map for writes                        |
| `OSVA_CONNECTOR_S3_CREATE_ENABLED`                | No       | Default `false`                            |
| `OSVA_CONNECTOR_S3_REPLACE_ENABLED`               | No       | Default `false`                            |
| `OSVA_CONNECTOR_S3_HOST_WRITES_APPROVED`          | No       | Default `false`                            |
| `OSVA_CONNECTOR_S3_ACCOUNT_WIDE_BUCKET_DISCOVERY` | No       | Default `false` (list uses allowlist only) |

AWS credentials use the default SDK provider chain (environment, profile, IAM role).

## Limits

- Text MIME allowlist: `text/plain`, `text/markdown`, `text/csv`, `application/json`, `application/x-ndjson`
- Max read/write body: **64 KiB**
- Pagination: opaque `continuationToken` (in-memory store; not raw S3 tokens)

## Run

```bash
osva-connector-aws-s3
```
