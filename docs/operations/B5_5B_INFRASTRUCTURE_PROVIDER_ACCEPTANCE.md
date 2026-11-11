# B5.5B — Infrastructure provider acceptance

Extends the B5.5A live-provider harness with executable acceptance scenarios for **eight infrastructure connectors** (storage, databases, vector). GitHub remains the B5.5A SaaS pilot unchanged.

## Connectors in scope

| Directory    | Provider   | Harness test resource env                                                            |
| ------------ | ---------- | ------------------------------------------------------------------------------------ |
| `aws-s3`     | Amazon S3  | `OSVA_LIVE_PROVIDER_S3_TEST_BUCKET`, `OSVA_LIVE_PROVIDER_S3_TEST_PREFIX`             |
| `gcs`        | GCS        | `OSVA_LIVE_PROVIDER_GCS_TEST_BUCKET`, `OSVA_LIVE_PROVIDER_GCS_TEST_PREFIX`           |
| `azure-blob` | Azure Blob | `OSVA_LIVE_PROVIDER_AZURE_TEST_CONTAINER`, `OSVA_LIVE_PROVIDER_AZURE_TEST_PREFIX`    |
| `bigquery`   | BigQuery   | `OSVA_LIVE_PROVIDER_BIGQUERY_TEST_DATASET`, `OSVA_LIVE_PROVIDER_BIGQUERY_TEST_TABLE` |
| `snowflake`  | Snowflake  | `OSVA_LIVE_PROVIDER_SNOWFLAKE_TEST_SCHEMA`                                           |
| `postgres`   | PostgreSQL | `OSVA_LIVE_PROVIDER_POSTGRES_ALLOWLIST_SCHEMA`                                       |
| `qdrant`     | Qdrant     | `OSVA_LIVE_PROVIDER_QDRANT_TEST_COLLECTION`                                          |
| `pinecone`   | Pinecone   | `OSVA_LIVE_PROVIDER_PINECONE_TEST_INDEX`                                             |

## Execution modes

| Mode          | Trigger                                              | Network             |
| ------------- | ---------------------------------------------------- | ------------------- |
| Preflight     | default CLI                                          | No                  |
| Mock policy   | dist built; runs in harness process                  | No                  |
| Mock vitest   | `--mock` or `OSVA_LIVE_PROVIDER_RUN_MOCK_FIXTURES=1` | No                  |
| Live read     | `OSVA_LIVE_PROVIDER_EXECUTE=1` + sandbox env         | Yes (operator only) |
| Live mutation | `OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED=1`            | Deferred            |

Scenario statuses: `PASSED`, `FAILED`, `SKIPPED`, `BLOCKED`, `NOT_RUN`. Mock passes are **not** proof of live-provider success.

## Commands

```bash
# Full 45-connector matrix (versions from workspace)
node scripts/live-provider/live-provider-acceptance.mjs --matrix-only

# B5.5B infrastructure preflight (8 connectors, no network)
node scripts/live-provider/live-provider-acceptance.mjs --infrastructure

# One connector
node scripts/live-provider/live-provider-acceptance.mjs --connector gcs

# Vitest-backed mock acceptance (build packages first)
pnpm --filter @osva-ai/connector-gcs build
node scripts/live-provider/live-provider-acceptance.mjs --infrastructure --mock

# B5.5A pilot slice (aws-s3, bigquery, github)
node scripts/live-provider/live-provider-acceptance.mjs --pilot

# Harness unit tests
node --test scripts/live-provider/live-provider-acceptance.test.mjs
```

## Gates (unchanged from B5.5A)

- `OSVA_LIVE_PROVIDER_EXECUTE=1` — required for live read scenarios at the **scenario runner** boundary (`liveReadGate`).
- `OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED=1` — required for mutations (still `NOT_RUN` / blocked for infrastructure).
- Connector allowlists + harness test resource env must both be set for live reads.

## Minimum sandbox setup (per provider)

### AWS S3

- Dedicated bucket + prefix; IAM read-only for acceptance prefix.
- `OSVA_CONNECTOR_S3_REGION`, `OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ` (JSON map).
- Harness: `OSVA_LIVE_PROVIDER_S3_TEST_*`.
- Disable account-wide discovery (default).

### Google Cloud Storage

- Sandbox bucket; `OSVA_CONNECTOR_GCS_PROJECT_ID`, `OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_READ`.
- ADC via `GOOGLE_APPLICATION_CREDENTIALS`.
- **Limitation:** list operations may not honor harness `requestTimeoutMs` on all SDK paths (documented in connector).

### Azure Blob Storage

- Storage account + container allowlist; `OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_NAME`, `OSVA_CONNECTOR_AZURE_BLOB_ALLOWED_CONTAINERS_READ`.
- `OSVA_CONNECTOR_AZURE_BLOB_TIMEOUT_MS` is passed into SDK abort signals for container/blob operations.

### BigQuery

- Sandbox project/dataset; `OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS`, `OSVA_CONNECTOR_BIGQUERY_MAX_BYTES_BILLED`.
- Live read: dataset list/metadata only — no billable SQL unless operator adds an explicit configured SELECT scenario later.

### Snowflake

- Trial/sandbox account; least-privilege role; schema allowlist.
- Live read: bounded `SELECT CURRENT_DATABASE()` only when execute gate is on.

### PostgreSQL

- Read-only role; `OSVA_CONNECTOR_POSTGRES_URL`, `OSVA_CONNECTOR_POSTGRES_ALLOWED_SCHEMAS`.
- Harness does not start Docker; integration DB is operator-provided.

### Qdrant

- Cloud cluster or approved endpoint; collection allowlist; writes off.
- SSRF/local URL policy enforced in connector — harness mock tests do not prove live SSRF immunity.

### Pinecone

- Dedicated index; `OSVA_CONNECTOR_PINECONE_ALLOWED_INDEXES`.
- Live read: control-plane `describeIndex` only (no upserts).

## Evidence

Reports under `audit-results/live-provider-acceptance/` with secrets redacted (`live-provider-redact.mjs`), including PostgreSQL URL patterns.

## Deferred

- Live execution of all eight in CI (manual operator sandboxes only).
- Mutation acceptance (B5.5D).
- SaaS connectors (B5.5C).
