# B3 connector npm publication record

**Verified:** 2026-11-08 (`npm view` + registry consumer acceptance)

Batch 3 completes the OSVA connector npm inventory: **22 / 22** connector packages are installable from the public registry at their current release lines. Historical M19 scope and publication history remain in [M19_PUBLICATION_RECORD.md](./M19_PUBLICATION_RECORD.md) (unchanged).

All seven B3 bootstrap releases ship **`@osva-ai/connector-sdk@1.1.4`** in published tarball metadata (confirmed on clean registry installs).

## Published versions (B3 @ `0.1.0`)

| Package                              | Version   | Batch | Workflow                                                                                |
| ------------------------------------ | --------- | ----- | --------------------------------------------------------------------------------------- |
| `@osva-ai/connector-gmail`           | **0.1.0** | B3.1  | [npm-release-gmail.yml](../.github/workflows/npm-release-gmail.yml)                     |
| `@osva-ai/connector-google-calendar` | **0.1.0** | B3.1  | [npm-release-google-calendar.yml](../.github/workflows/npm-release-google-calendar.yml) |
| `@osva-ai/connector-notion`          | **0.1.0** | B3.2  | [npm-release-notion.yml](../.github/workflows/npm-release-notion.yml)                   |
| `@osva-ai/connector-linear`          | **0.1.0** | B3.2  | [npm-release-linear.yml](../.github/workflows/npm-release-linear.yml)                   |
| `@osva-ai/connector-exa`             | **0.1.0** | B3.3  | [npm-release-exa.yml](../.github/workflows/npm-release-exa.yml)                         |
| `@osva-ai/connector-tavily`          | **0.1.0** | B3.3  | [npm-release-tavily.yml](../.github/workflows/npm-release-tavily.yml)                   |
| `@osva-ai/connector-firecrawl`       | **0.1.0** | B3.3  | [npm-release-firecrawl.yml](../.github/workflows/npm-release-firecrawl.yml)             |

## Registry publication confirmation

`npm view @osva-ai/<connector>@0.1.0 version` returned **`0.1.0`** for all seven packages on **2026-11-08**.

Full monorepo inventory (**22** packages): every connector has a resolvable `npm view … version` on the public registry (see [compatibility.md](./compatibility.md#release-status)).

## Registry consumer acceptance (not pack/tarball)

Command (isolated temp project, dedicated `NPM_CONFIG_CACHE`, public registry only):

```bash
node scripts/package-acceptance-registry-b3.mjs
```

| Package                              | MCP smoke | Integrity (registry = lock) | Notes                                                                   |
| ------------------------------------ | --------- | --------------------------- | ----------------------------------------------------------------------- |
| `@osva-ai/connector-gmail`           | **Pass**  | `sha512-gFZ6C+…`            | `tools/list` + schema validation call only                              |
| `@osva-ai/connector-google-calendar` | **Pass**  | `sha512-AfqLz…`             | Same pattern                                                            |
| `@osva-ai/connector-notion`          | **Pass**  | `sha512-crNPa…`             | Same pattern                                                            |
| `@osva-ai/connector-linear`          | **Pass**  | `sha512-6Ab29…`             | Same pattern                                                            |
| `@osva-ai/connector-exa`             | **Pass**  | `sha512-LvnaM…`             | Missing-credential startup failure + fake API key fixture for discovery |
| `@osva-ai/connector-tavily`          | **Pass**  | `sha512-L2fm3…`             | Same as Exa                                                             |
| `@osva-ai/connector-firecrawl`       | **Pass**  | `sha512-6RE/7…`             | Same as Exa                                                             |

**Credential-free vs authenticated:** Acceptance uses existing `scripts/package-acceptance-*-smoke.mjs` fixtures. Discovery (`tools/list`, export resolution, invalid-argument handling) runs without real provider credentials where the connector allows it. Exa, Tavily, and Firecrawl smoke tests use **non-production fixture API keys** for stdio startup and list/discovery only — **not** live provider success. Google Workspace, Notion, and Linear smokes validate MCP discovery and safe validation calls without live OAuth/API tokens.

**Not executed in this closeout:** End-to-end success against live Gmail, Google Calendar, Notion, Linear, Exa, Tavily, or Firecrawl APIs.

## Provenance status

Bootstrap operator uploads used **`npm publish --access public --provenance=false`** (see [scripts/publish-b3-batch.ps1](../scripts/publish-b3-batch.ps1)).

Registry metadata for **`0.1.0`** tarballs includes npm **`dist.signatures`** (reported as `signatures-present` by the acceptance script). Do **not** assume Sigstore **provenance attestations** from OIDC workflows on these bootstrap versions until a patch is published via GitHub Actions with `npm publish --provenance`.

Future OIDC releases should produce full provenance; bootstrap `0.1.0` lines remain immutable.

## SDK 1.1.4 compatibility

| Check                                             | Result      |
| ------------------------------------------------- | ----------- |
| `dependencies[@osva-ai/connector-sdk]` on tarball | **`1.1.4`** |
| Installed SDK from registry in acceptance         | **`1.1.4`** |
| `engines.node`                                    | **`>=24`**  |
| `bin` → `dist/stdio.js`                           | Verified    |

## GitHub Actions trusted publishing (future OIDC releases)

Each B3 package has an independent `workflow_dispatch` release workflow (`permissions.id-token: write`, environment **`npm`**). **Trusted Publisher entries are not configured in this closeout** — configure on npm **after** the package exists (already satisfied for `0.1.0`).

Per package, on [npmjs.com](https://www.npmjs.com/) → package → **Settings** → **Trusted Publisher** → **GitHub Actions**:

| Package         | Workflow filename                 | Environment |
| --------------- | --------------------------------- | ----------- |
| Gmail           | `npm-release-gmail.yml`           | `npm`       |
| Google Calendar | `npm-release-google-calendar.yml` | `npm`       |
| Notion          | `npm-release-notion.yml`          | `npm`       |
| Linear          | `npm-release-linear.yml`          | `npm`       |
| Exa             | `npm-release-exa.yml`             | `npm`       |
| Tavily          | `npm-release-tavily.yml`          | `npm`       |
| Firecrawl       | `npm-release-firecrawl.yml`       | `npm`       |

| Field        | Value             |
| ------------ | ----------------- |
| Organization | `Osva-AI`         |
| Repository   | `osva-connectors` |

**First OIDC upload for a new semver:** run workflow on `main` with `dry_run=false`, `confirm_publish=true`, after Environment **`npm`** approval. Workflows refuse re-upload of an existing version. Use `dry_run=true` for validation-only runs.

**Fallback:** `NPM_TOKEN` in the GitHub Environment **`npm`** (workflows support token or OIDC).

## Known limitations and deferred verification

- **Live provider journeys** (OAuth, Notion integration tokens, Linear API, paid search/crawl quotas) are operator responsibility; see per-package INSTALL guides.
- **Bootstrap `0.1.0`** lacks OIDC provenance attestations; plan **`0.1.1+`** (or appropriate patch) for first trusted-publisher upload when needed.
- **Batch Windows script** `publish-b3-batch.ps1` is validated for **DryRun** preflight only; **Publish** mode is not certified for npm **EOTP/2FA** in this environment (use interactive per-package `npm publish` or GitHub Actions).

## Operator batch script

See [scripts/publish-b3-batch.ps1](../scripts/publish-b3-batch.ps1): default **DryRun** (registry precheck, build, `npm publish --dry-run`). **Publish** mode requires explicit `-ConfirmBatch` and is optional / unverified for interactive OTP.
