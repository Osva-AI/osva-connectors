# B5.0 Version Plan — 45 `@osva-ai/connector-*` packages

**Do not apply these bumps in B5.0.** This is the coordinated target for B5.1.

**Evidence for “needs release”:** `git diff 1810896..HEAD -- packages/<dir>` non-empty.
**Registry check:** `audit-results/full-connector-audit/npm-registry.json` queried `2026-11-10T13:13:31Z` — all 45 FOUND, version strings match repo.

## Version-change matrix

| Package | Repo dir | Repo version | npm latest | Proposed | Change | Release? | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `@osva-ai/connector-amplitude` | amplitude | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta since `1810896` |
| `@osva-ai/connector-aws-s3` | aws-s3 | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R1 prefix allowlist; R3 HTTP timeouts (R1–R3) |
| `@osva-ai/connector-azure-blob` | azure-blob | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R1 prefix allowlist (R1); resolve dead `requestTimeoutMs` before or with bump |
| `@osva-ai/connector-bigcommerce` | bigcommerce | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-bigquery` | bigquery | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R1 SQL/allowlist security (R1); document timeout caveats |
| `@osva-ai/connector-confluence` | confluence | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-exa` | exa | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-firecrawl` | firecrawl | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 crawl path + id binding (R2) |
| `@osva-ai/connector-freshdesk` | freshdesk | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 conversation field normalization (R2) |
| `@osva-ai/connector-ga4` | ga4 | 0.1.1 | 0.1.1 | 0.1.1 | — | No | No source delta |
| `@osva-ai/connector-gcs` | gcs | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R1 allowlist; R3 listing options / per-call timeout on non-list ops |
| `@osva-ai/connector-github` | github | 0.3.1 | 0.3.1 | 0.4.0 | minor | **Yes** | R3 optional repo allowlist (new env; backward compatible) |
| `@osva-ai/connector-gmail` | gmail | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-google-ads` | google-ads | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 Search body fix (R2) |
| `@osva-ai/connector-google-calendar` | google-calendar | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-google-drive` | google-drive | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-google-sheets` | google-sheets | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-gsc` | gsc | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-hubspot` | hubspot | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-intercom` | intercom | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 conversation parts + R3 `startingAfter` pagination |
| `@osva-ai/connector-jira` | jira | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 JQL ORDER BY (R2) |
| `@osva-ai/connector-klaviyo` | klaviyo | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-linear` | linear | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 mutation/list fixes (R2) |
| `@osva-ai/connector-meta-ads` | meta-ads | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-mixpanel` | mixpanel | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-notion` | notion | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R3 dual-version block append `after` (R3) |
| `@osva-ai/connector-npm` | npm | 0.1.1 | 0.1.1 | 0.1.1 | — | No | No source delta |
| `@osva-ai/connector-onedrive` | onedrive | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 Graph download redirect guard (R2) |
| `@osva-ai/connector-outlook` | outlook | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 nextLink binding (R2) |
| `@osva-ai/connector-pinecone` | pinecone | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 API 2025-10 stats (R2) |
| `@osva-ai/connector-pipedrive` | pipedrive | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-postgres` | postgres | 0.1.1 | 0.1.1 | 0.1.1 | — | No* | No source delta; *optional infra-only patch for OIDC backup canary |
| `@osva-ai/connector-qdrant` | qdrant | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 IPv6 SSRF (R2) |
| `@osva-ai/connector-salesforce` | salesforce | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-shopify` | shopify | 0.1.1 | 0.1.1 | 0.1.1 | — | No | No source delta |
| `@osva-ai/connector-slack` | slack | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-snowflake` | snowflake | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R1 cancel + bounded stream (R1) |
| `@osva-ai/connector-stripe` | stripe | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-supabase` | supabase | 0.1.0 | 0.1.0 | 0.1.1 | patch | **Yes** | R2 JWT policy (R2) |
| `@osva-ai/connector-tavily` | tavily | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-teams` | teams | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-whatsapp` | whatsapp | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-woocommerce` | woocommerce | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-zendesk` | zendesk | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |
| `@osva-ai/connector-zoho-crm` | zoho-crm | 0.1.0 | 0.1.0 | 0.1.0 | — | No | No source delta |

**Summary:** 18 require publication; 27 unchanged (26 strictly + optional postgres infra patch).

## Files that must change together per package (B5.1)

For each bumped package:

1. `packages/<dir>/package.json` — `version`
2. `packages/<dir>/src/constants.ts` — `CONNECTOR_VERSION` (all connectors use this pattern)
3. `.github/workflows/npm-release[-<dir>].yml` — `inputs.expected_version` default / validation
4. Root `pnpm-lock.yaml` when workspace deps reference connector versions (if any)
5. `docs/connector-catalog.json` — regenerate via existing catalog script after bumps
6. User-facing `docs/compatibility.md` — sync published set (deferred doc task F-P2-01 partial)

GitHub-specific: `npm-release.yml` (not `npm-release-github.yml`).

## Semver notes

- **GitHub 0.4.0:** New optional env var; compatible default (unset = prior behavior).
- **0.x patches:** Per npm semver, breaking MCP tool contract changes should not be disguised as patch; none identified in R1–R3 for listed packages.
- **Immutability:** Never republish an existing npm version; bump if a canary fails after partial upload.
