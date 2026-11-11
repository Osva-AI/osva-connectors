# B5.5A — Live provider acceptance foundation

This milestone adds a **reusable harness** for validating OSVA connectors against real provider sandboxes. It extends — not replaces — existing `scripts/package-acceptance-*` and B5.4 `published-package-acceptance` flows.

## Principles

- **Preflight by default** — no provider HTTP unless `OSVA_LIVE_PROVIDER_EXECUTE=1`.
- **Mutations off by default** — require `OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED=1` plus operator approval; B5.5A pilot keeps mutation scenarios `NOT_RUN`.
- **Never mark unexecuted live checks as PASSED** — matrix defaults to `NOT_RUN`.
- **Evidence is redacted** — reports strip tokens, PATs, and env secret values.

## Artifact layout

| Path                                                      | Purpose                                  |
| --------------------------------------------------------- | ---------------------------------------- |
| `scripts/live-provider/live-provider-acceptance.mjs`      | CLI entry                                |
| `scripts/live-provider/live-provider-acceptance-core.mjs` | Matrix, reporting, orchestration         |
| `scripts/live-provider/live-provider-matrix-meta.mjs`     | Static per-connector risk metadata       |
| `scripts/live-provider/scenarios/*`                       | Pilot runners (aws-s3, bigquery, github) |
| `docs/operations/live-provider-acceptance-matrix.md`      | Generated 45-connector matrix            |
| `audit-results/live-provider-acceptance/*.json`           | Run evidence                             |

## Commands

Emit the full matrix (versions from workspace `package.json`):

```bash
node scripts/live-provider/live-provider-acceptance.mjs --matrix-only
```

Run the **pilot** (preflight only; live reads stay `BLOCKED` without credentials + execute gate):

```bash
node scripts/live-provider/live-provider-acceptance.mjs --pilot
```

Include in-repo vitest fixture paths (slow; optional):

```bash
set OSVA_LIVE_PROVIDER_RUN_MOCK_FIXTURES=1
node scripts/live-provider/live-provider-acceptance.mjs --pilot --mock
```

Authorized **live read** smoke (operator sandbox only):

```powershell
$env:OSVA_LIVE_PROVIDER_EXECUTE = "1"
# AWS S3 pilot example — see matrix for full list
$env:OSVA_CONNECTOR_S3_REGION = "us-east-1"
$env:OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ = '{"my-acceptance-bucket":["acceptance/"]}'
$env:OSVA_LIVE_PROVIDER_S3_TEST_BUCKET = "my-acceptance-bucket"
$env:OSVA_LIVE_PROVIDER_S3_TEST_PREFIX = "acceptance/"
# AWS credentials via standard AWS env/profile
pnpm --filter @osva-ai/connector-aws-s3 build
node scripts/live-provider/live-provider-acceptance.mjs --connector aws-s3
```

Focused unit tests for the harness:

```bash
node --test scripts/live-provider/live-provider-acceptance.test.mjs
```

## Pilot sandbox credentials (human-provided)

| Connector    | Required operator setup                                                                    |
| ------------ | ------------------------------------------------------------------------------------------ |
| **aws-s3**   | Dedicated bucket + prefix; IAM read + optional gated write; `OSVA_LIVE_PROVIDER_S3_TEST_*` |
| **bigquery** | GCP project with sandbox dataset; `GOOGLE_APPLICATION_CREDENTIALS`; bytes-billed cap env   |
| **github**   | Fine-grained PAT scoped to one sandbox repo; `OSVA_LIVE_PROVIDER_GITHUB_TEST_*`            |

## Security controls

- No credentials in source; harness env documented only in this file and the matrix.
- `evaluateMutationPolicy()` fails preflight if mutation-related `OSVA_CONNECTOR_*` flags are enabled without `OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED`.
- Live scenarios require explicit bucket/repo/dataset harness variables in addition to connector allowlists.
- Report objects pass through `redactLiveProviderSecrets()` before write.

## B5.5B

Infrastructure acceptance (8 connectors) is documented in [B5_5B_INFRASTRUCTURE_PROVIDER_ACCEPTANCE.md](./B5_5B_INFRASTRUCTURE_PROVIDER_ACCEPTANCE.md).

## Deferred (post B5.5A)

- Live scenarios for remaining 37 connectors (matrix metadata present; runners not implemented).
- Mutation and destructive scenario implementations (GitHub issue create, S3 create, etc.).
- CI scheduling (manual operator runs only).
- `audit-results/full-connector-audit/LIVE_PROVIDER_ACCEPTANCE_PLAN.md` (not present locally; L4 still referenced from B5.0 docs).

## Relationship to B5.4

B5.4 validates **published npm artifacts** (install, provenance, MCP smoke). B5.5A validates **provider integration behavior** under sandbox policy. Run B5.4 before release; run B5.5A when changing auth, scope, or provider client logic.
