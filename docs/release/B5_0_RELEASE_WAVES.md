# B5.0 Release Waves

Controlled publication sequence for **18** packages requiring new versions. No mass dispatch; human approval per workflow.

## Wave 0 — OIDC canary

| Package | Version | Workflow | Trusted publisher | Preconditions |
| --- | --- | --- | --- | --- |
| `@osva-ai/connector-github` | 0.4.0 | `npm-release.yml` | CONFIGURED | B5.1 version bump; env reviewers; OIDC canary doc |

**Success:** `@0.4.0` on registry with attestations; published-artifact acceptance for GitHub.

**Backup path:** `connector-postgres@0.1.2` only if GitHub blocked—infrastructure-only patch with CONFIGURED publisher.

---

## Wave 1 — Security and data-plane fixes

High-value R1 security + storage correctness. Register trusted publisher **per package** before each dispatch.

| Package | Proposed | Workflow | R wave | Blockers |
| --- | --- | --- | --- | --- |
| `@osva-ai/connector-bigquery` | 0.1.1 | `npm-release-bigquery.yml` | R1 | Document/fix dead `requestTimeoutMs` before publish |
| `@osva-ai/connector-snowflake` | 0.1.1 | `npm-release-snowflake.yml` | R1 | None |
| `@osva-ai/connector-aws-s3` | 0.1.1 | `npm-release-aws-s3.yml` | R1+R3 | None |
| `@osva-ai/connector-gcs` | 0.1.1 | `npm-release-gcs.yml` | R1+R3 | List timeout limitation documented |
| `@osva-ai/connector-azure-blob` | 0.1.1 | `npm-release-azure-blob.yml` | R1 | Wire or document `requestTimeoutMs` |
| `@osva-ai/connector-supabase` | 0.1.1 | `npm-release-supabase.yml` | R2 | None |
| `@osva-ai/connector-qdrant` | 0.1.1 | `npm-release-qdrant.yml` | R2 | None |

**Acceptance:** Per-package `pnpm test:package-acceptance:<slug>` + published install smoke.

**Suggested batch size:** 2–3 packages per day (publisher setup + human review load).

---

## Wave 2 — Provider correctness (R2 + R3)

| Package | Proposed | Workflow | Notes |
| --- | --- | --- | --- |
| `@osva-ai/connector-intercom` | 0.1.1 | `npm-release-intercom.yml` | Pagination + R2 parts |
| `@osva-ai/connector-notion` | 0.1.1 | `npm-release-notion.yml` | Block append |
| `@osva-ai/connector-linear` | 0.1.1 | `npm-release-linear.yml` | R2 fixes |
| `@osva-ai/connector-jira` | 0.1.1 | `npm-release-jira.yml` | JQL |
| `@osva-ai/connector-freshdesk` | 0.1.1 | `npm-release-freshdesk.yml` | Normalization |
| `@osva-ai/connector-firecrawl` | 0.1.1 | `npm-release-firecrawl.yml` | Crawl path |
| `@osva-ai/connector-google-ads` | 0.1.1 | `npm-release-google-ads.yml` | Search body |
| `@osva-ai/connector-onedrive` | 0.1.1 | `npm-release-onedrive.yml` | Redirect guard |
| `@osva-ai/connector-outlook` | 0.1.1 | `npm-release-outlook.yml` | nextLink |
| `@osva-ai/connector-pinecone` | 0.1.1 | `npm-release-pinecone.yml` | API version |

**Precondition:** Wave 0 OIDC path proven (workflow auth scripts unchanged).

---

## Wave 3 — No publication (27 packages)

Remain at current npm versions until a future change warrants a bump:

`amplitude`, `bigcommerce`, `confluence`, `exa`, `ga4`, `gmail`, `google-calendar`, `google-drive`, `google-sheets`, `gsc`, `hubspot`, `klaviyo`, `meta-ads`, `mixpanel`, `npm`, `pipedrive`, `postgres`, `salesforce`, `shopify`, `slack`, `stripe`, `teams`, `tavily`, `whatsapp`, `woocommerce`, `zendesk`, `zoho-crm`

Do not publish solely to round out publisher coverage.

---

## Per-wave validation commands (operator)

```bash
# Before dispatch
git rev-parse --abbrev-ref HEAD   # => main
git status --short                 # clean tree

pnpm --filter @osva-ai/connector-<slug> lint typecheck build test

# After publish
npm view @osva-ai/connector-<slug>@<version> version
npm dist-tag ls @osva-ai/connector-<slug>
```

## Trusted publisher workflow

For each Wave 1–2 package (all **MISSING** in CSV):

1. npm → package → Access → **Trusted publishers** → GitHub Actions.
2. Match: org `Osva-AI`, repo `osva-connectors`, workflow filename from table, environment `npm`.
3. Dispatch publish only after publisher shows active (npm validation window applies).

Preserve existing five publishers; do not bulk-create 40 during B5.0.
