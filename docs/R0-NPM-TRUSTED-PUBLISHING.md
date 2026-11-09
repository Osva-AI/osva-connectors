# R0 npm release hardening — trusted publisher readiness

R0 makes all 45 connector release workflows statically ready for GitHub Actions OIDC trusted publishing. It does **not** create trusted publishers, publish packages, or prove that OIDC authentication works in GitHub Actions.

Dry-run is packaging validation only. A workflow is **READY_FOR_CANARY** when its YAML and local checks are correct. It is **VERIFIED** only after a human-approved OIDC upload succeeds.

## Token fallback tradeoff

OIDC is the default publish path. `use_npm_token` defaults to `false`.

| Choice                          | What happens                                                                                                                                                | Risk                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Default OIDC                    | Empty `NODE_AUTH_TOKEN` and setup-node `_authToken` placeholders are stripped. Missing trusted publisher fails at `npm publish` as an authentication error. | Controlled failure. No silent token path.                              |
| Explicit `use_npm_token=true`   | Requires a non-empty `NPM_TOKEN` secret. Empty token does **not** fall through to OIDC.                                                                     | Long-lived token; bypasses trusted-publisher identity. Emergency only. |
| Previous always-token workflows | `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` even when the secret was empty.                                                                                 | Empty token blocked OIDC. Unsafe default.                              |

**After every package has a successful human-approved OIDC canary:** remove `NPM_TOKEN` from the GitHub `npm` environment and delete the `use_npm_token` input plus token branches from the shared publish scripts.

Do not treat a present `NPM_TOKEN` as automatic fallback. That would select the token path accidentally whenever the secret still exists.

## GitHub `npm` environment (read-only observation)

Queried `GET /repos/Osva-AI/osva-connectors/environments/npm` during R0. **Do not change environment settings from this patch.**

Observed:

- Environment `npm` exists.
- `protection_rules` is empty — **required reviewers are not configured**.
- `deployment_branch_policy` is `null` — GitHub will not itself restrict the environment to `main` (workflows still refuse non-`main` refs).
- Environment secrets list is empty — `NPM_TOKEN` is not present, which is correct for OIDC canaries.
- `can_admins_bypass` is `true`.

Manual configuration required before the first real upload:

1. Add required reviewers on `https://github.com/Osva-AI/osva-connectors/settings/environments/npm`.
2. Optionally restrict deployment branches to `main`.
3. Keep `NPM_TOKEN` absent unless a human is executing explicit `use_npm_token=true`.

## Human-operated publication checklist

Do these steps on a trusted machine. Do not dispatch workflows, create publishers, or publish from automation unless a human is executing this list.

### 1. Verify GitHub environment protections

- Open Environment `npm`.
- Confirm required reviewers.
- Confirm secrets: `NPM_TOKEN` should be absent for OIDC canaries.

### 2. Review existing trusted publishers

Already configured (do not recreate, do not delete):

- `@osva-ai/connector-github` → `.github/workflows/npm-release.yml`
- `@osva-ai/connector-ga4` → `.github/workflows/npm-release-ga4.yml`
- `@osva-ai/connector-npm` → `.github/workflows/npm-release-npm.yml`
- `@osva-ai/connector-postgres` → `.github/workflows/npm-release-postgres.yml`
- `@osva-ai/connector-shopify` → `.github/workflows/npm-release-shopify.yml`

On npmjs.com each publisher must match:

- Organization / user: `Osva-AI`
- Repository: `osva-connectors`
- Workflow filename above
- Environment: `npm`

### 3. Create missing publishers shortly before each release

Create the trusted publisher for a package only when that package has a **new unpublished version** ready. npm cannot attach a trusted publisher until the package already exists (all 45 currently exist).

Do not bulk-create the 40 missing publishers during R0.

### 4. Human-approved OIDC canary

Recommended first canary: `@osva-ai/connector-github` (publisher already configured) after a real patch bump.

1. Land the version bump on `main`.
2. Dispatch **Release to npm** with `dry_run=true` (default). This does not prove OIDC.
3. Dispatch again with `dry_run=false` and `confirm_publish=true`. Leave `use_npm_token=false`.
4. Approve the `npm` environment.
5. No GitHub tag is required for npm publication.
6. Do not change dist-tags.

### 5. Verify version, dist-tag, and provenance

```bash
npm view @osva-ai/connector-<name>@<version> version
npm dist-tag ls @osva-ai/connector-<name>
npm view @osva-ai/connector-<name>@<version> dist.attestations
```

`latest` should move to the new version only as npm's default publish behavior. Do not delete existing dist-tags.

### 6. Preserve successful publisher configuration

After a successful OIDC canary, leave the trusted publisher in place. Record the workflow filename and environment `npm`.

### 7. Failed or expired publishers

- Do not delete a working publisher to “retry”.
- If npm reports the publisher missing or expired, recreate the **same** workflow + environment pair, then rerun a confirmed OIDC publish of a **new** version.
- Never republish an immutable version.
- Do not switch to `use_npm_token=true` unless OIDC is blocked and a human accepts the token risk.

## Readiness matrix

Trust status is the known npm configuration as of R0. It was not changed here.

OIDC publishing is not VERIFIED for any package: no human-approved OIDC upload was executed in R0.

| Package                              | Workflow                          | Trust Status | OIDC Ready       | Blocker                                                                  |
| ------------------------------------ | --------------------------------- | ------------ | ---------------- | ------------------------------------------------------------------------ |
| `@osva-ai/connector-github`          | `npm-release.yml`                 | CONFIGURED   | READY_FOR_CANARY | Needs human-approved OIDC upload of a new version                        |
| `@osva-ai/connector-ga4`             | `npm-release-ga4.yml`             | CONFIGURED   | READY_FOR_CANARY | Needs human-approved OIDC upload of a new version                        |
| `@osva-ai/connector-npm`             | `npm-release-npm.yml`             | CONFIGURED   | READY_FOR_CANARY | Needs human-approved OIDC upload of a new version                        |
| `@osva-ai/connector-postgres`        | `npm-release-postgres.yml`        | CONFIGURED   | READY_FOR_CANARY | Needs human-approved OIDC upload of a new version                        |
| `@osva-ai/connector-shopify`         | `npm-release-shopify.yml`         | CONFIGURED   | READY_FOR_CANARY | Needs human-approved OIDC upload of a new version                        |
| `@osva-ai/connector-amplitude`       | `npm-release-amplitude.yml`       | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-aws-s3`          | `npm-release-aws-s3.yml`          | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-azure-blob`      | `npm-release-azure-blob.yml`      | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-bigcommerce`     | `npm-release-bigcommerce.yml`     | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-bigquery`        | `npm-release-bigquery.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-confluence`      | `npm-release-confluence.yml`      | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-exa`             | `npm-release-exa.yml`             | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-firecrawl`       | `npm-release-firecrawl.yml`       | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-freshdesk`       | `npm-release-freshdesk.yml`       | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-gcs`             | `npm-release-gcs.yml`             | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-gmail`           | `npm-release-gmail.yml`           | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-google-ads`      | `npm-release-google-ads.yml`      | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-google-calendar` | `npm-release-google-calendar.yml` | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-google-drive`    | `npm-release-google-drive.yml`    | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-google-sheets`   | `npm-release-google-sheets.yml`   | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-gsc`             | `npm-release-gsc.yml`             | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-hubspot`         | `npm-release-hubspot.yml`         | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-intercom`        | `npm-release-intercom.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-jira`            | `npm-release-jira.yml`            | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-klaviyo`         | `npm-release-klaviyo.yml`         | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-linear`          | `npm-release-linear.yml`          | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-meta-ads`        | `npm-release-meta-ads.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-mixpanel`        | `npm-release-mixpanel.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-notion`          | `npm-release-notion.yml`          | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-onedrive`        | `npm-release-onedrive.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-outlook`         | `npm-release-outlook.yml`         | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-pinecone`        | `npm-release-pinecone.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-pipedrive`       | `npm-release-pipedrive.yml`       | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-qdrant`          | `npm-release-qdrant.yml`          | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-salesforce`      | `npm-release-salesforce.yml`      | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-slack`           | `npm-release-slack.yml`           | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-snowflake`       | `npm-release-snowflake.yml`       | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-stripe`          | `npm-release-stripe.yml`          | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-supabase`        | `npm-release-supabase.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-tavily`          | `npm-release-tavily.yml`          | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-teams`           | `npm-release-teams.yml`           | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-whatsapp`        | `npm-release-whatsapp.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-woocommerce`     | `npm-release-woocommerce.yml`     | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-zendesk`         | `npm-release-zendesk.yml`         | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
| `@osva-ai/connector-zoho-crm`        | `npm-release-zoho-crm.yml`        | MISSING      | READY_FOR_CANARY | Create trusted publisher immediately before the next unpublished version |
