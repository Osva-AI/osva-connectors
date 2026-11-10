# B5.1 Version Matrix (45 packages)

**Version sync rule:** `package.json` == `CONNECTOR_VERSION` == workflow `expected_version` default (verified by `pnpm test:release-workflows`).

**npm latest** as of B5.1 prep (proposed versions return E404 — unpublished).

## Release candidates (18)

| Package                         | Old repo | New repo  | npm latest | Release | Wave | Workflow                     | Trust (CSV) | Verify                                |
| ------------------------------- | -------- | --------- | ---------- | ------- | ---- | ---------------------------- | ----------- | ------------------------------------- |
| `@osva-ai/connector-github`     | 0.3.1    | **0.4.0** | 0.3.1      | Yes     | 0    | `npm-release.yml`            | CONFIGURED  | lint/test/build/acceptance **PASSED** |
| `@osva-ai/connector-aws-s3`     | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 1    | `npm-release-aws-s3.yml`     | MISSING     | **PASSED**                            |
| `@osva-ai/connector-azure-blob` | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 1    | `npm-release-azure-blob.yml` | MISSING     | **PASSED** + timeout fix              |
| `@osva-ai/connector-bigquery`   | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 1    | `npm-release-bigquery.yml`   | MISSING     | **PASSED** + timeout fix              |
| `@osva-ai/connector-gcs`        | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 1    | `npm-release-gcs.yml`        | MISSING     | **PASSED**                            |
| `@osva-ai/connector-snowflake`  | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 1    | `npm-release-snowflake.yml`  | MISSING     | **PASSED**                            |
| `@osva-ai/connector-supabase`   | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 1    | `npm-release-supabase.yml`   | MISSING     | **PASSED**                            |
| `@osva-ai/connector-qdrant`     | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 1    | `npm-release-qdrant.yml`     | MISSING     | **PASSED**                            |
| `@osva-ai/connector-intercom`   | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-intercom.yml`   | MISSING     | **PASSED**                            |
| `@osva-ai/connector-notion`     | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-notion.yml`     | MISSING     | **PASSED**                            |
| `@osva-ai/connector-linear`     | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-linear.yml`     | MISSING     | **PASSED**                            |
| `@osva-ai/connector-jira`       | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-jira.yml`       | MISSING     | **PASSED**                            |
| `@osva-ai/connector-freshdesk`  | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-freshdesk.yml`  | MISSING     | **PASSED**                            |
| `@osva-ai/connector-firecrawl`  | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-firecrawl.yml`  | MISSING     | **PASSED**                            |
| `@osva-ai/connector-google-ads` | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-google-ads.yml` | MISSING     | **PASSED**                            |
| `@osva-ai/connector-onedrive`   | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-onedrive.yml`   | MISSING     | **PASSED**                            |
| `@osva-ai/connector-outlook`    | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-outlook.yml`    | MISSING     | **PASSED**                            |
| `@osva-ai/connector-pinecone`   | 0.1.0    | **0.1.1** | 0.1.0      | Yes     | 2    | `npm-release-pinecone.yml`   | MISSING     | **PASSED**                            |

## Unchanged (27) — Wave 3, no publish

All at prior repo/npm version (0.1.0 or 0.1.1 where already bumped historically):  
`amplitude`, `bigcommerce`, `confluence`, `exa`, `ga4`, `gmail`, `google-calendar`, `google-drive`, `google-sheets`, `gsc`, `hubspot`, `klaviyo`, `meta-ads`, `mixpanel`, `npm`, `pipedrive`, `postgres`, `salesforce`, `shopify`, `slack`, `stripe`, `teams`, `tavily`, `whatsapp`, `woocommerce`, `zendesk`, `zoho-crm`.

| Package              | Version        | Sync       | Release |
| -------------------- | -------------- | ---------- | ------- |
| (each unchanged row) | = npm `latest` | **PASSED** | No      |

Machine-readable versions: `docs/connector-catalog.json`.
