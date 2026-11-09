# @osva-ai/connector-gcs

OSVA Connector Profile V1 MCP connector for **Google Cloud Storage**.

## Tools (8)

| Tool                       | Access                            |
| -------------------------- | --------------------------------- |
| `gcs.bucket.list`          | Read                              |
| `gcs.bucket.get`           | Read                              |
| `gcs.object.list`          | Read (prefix required)            |
| `gcs.object.metadata.get`  | Read                              |
| `gcs.object.text.read`     | Read (UTF-8 text, MIME allowlist) |
| `gcs.object.versions.list` | Read (prefix required)            |
| `gcs.object.text.create`   | Write (`ifGenerationMatch=0`)     |
| `gcs.object.text.replace`  | Write (`ifGenerationMatch`)       |

## Configuration

| Variable                        | Required | Description    |
| ------------------------------- | -------- | -------------- |
| `OSVA_CONNECTOR_GCS_PROJECT_ID` | Yes      | GCP project id |

See environment variables mirroring the AWS S3 connector (`OSVA_CONNECTOR_GCS_*`).
