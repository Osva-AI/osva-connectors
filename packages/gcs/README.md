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

Object listing uses GCS prefix semantics: a list request is allowed only when its prefix equals an authorized prefix or is a descendant of one. An empty agent prefix cannot enumerate a bucket that is scoped to a narrower prefix. Map a bucket to `[""]` only when the whole bucket is intentionally in scope; `[]` is deny-all. `gcs.bucket.list` with account-wide discovery does not auto-paginate the Storage API.
