# M19 connector npm publication record

**Verified:** 2026-11-06 (`npm view` on the public registry)

All eight M19-scoped connector releases declare **`@osva-ai/connector-sdk@1.1.4`** in published tarball metadata (spot-checked on **`connector-github@0.3.1`** and **`connector-slack@0.1.0`**).

## GitHub Actions trusted publishing

Connector releases use [`.github/workflows/npm-release.yml`](../.github/workflows/npm-release.yml) with GitHub environment **`npm`** and npm **Trusted Publisher** configuration:

| Field             | Value             |
| ----------------- | ----------------- |
| Organization      | `Osva-AI`         |
| Repository        | `osva-connectors` |
| Workflow filename | `npm-release.yml` |
| Environment name  | **`npm`**         |

Release protections (manual workflow dispatch, environment approval, semver immutability) are unchanged from per-package [RELEASE-CHECKLIST*.md](./RELEASE-CHECKLIST.md) docs.

## Published versions (M19)

| Package                       | Version   | Notes                                          |
| ----------------------------- | --------- | ---------------------------------------------- |
| `@osva-ai/connector-slack`    | **0.1.0** | Wave 1 first publication                       |
| `@osva-ai/connector-stripe`   | **0.1.0** | Wave 1 first publication                       |
| `@osva-ai/connector-hubspot`  | **0.1.0** | Wave 1 first publication                       |
| `@osva-ai/connector-github`   | **0.3.1** | Registry realignment; **`latest`** → **0.3.1** |
| `@osva-ai/connector-postgres` | **0.1.1** | Registry realignment                           |
| `@osva-ai/connector-shopify`  | **0.1.1** | Registry realignment                           |
| `@osva-ai/connector-ga4`      | **0.1.1** | Registry realignment                           |
| `@osva-ai/connector-npm`      | **0.1.1** | Registry realignment; **`latest`** → **0.1.1** |

**Registry availability ≠ runtime acceptance:** OSVA cross-repo CI and operator ToolGateway journeys prove subsets of connectors against in-repo stacks. M19 publication evidence is **npm installability** and **SDK pin truth** on tarballs, not live provider success for every connector.

## Out of scope (unchanged)

Seven connectors remain **source-only** on npm (google-*, gsc, meta-ads, klaviyo, whatsapp, etc.). Do not publish them as part of M19 closeout.
