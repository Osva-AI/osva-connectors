# B5.5C — SaaS provider acceptance and mutation safety

Extends the live-provider harness to **37 SaaS / productivity / commerce connectors** (all matrix entries except the eight B5.5B infrastructure packages).

## Scope

- **Priority 0** (deepest mock policy + mutation inventory): GitHub, Stripe, Shopify, WooCommerce, BigCommerce, Zendesk, Intercom, Freshdesk, Jira, Linear, Notion.
- **Priority 1** (preflight + inventory): Outlook, OneDrive, Teams, Confluence, Gmail, Google Drive/Calendar/Sheets, …
- **Priority 2** (preflight + read-only inventory): GA4, Google Ads, Mixpanel, Amplitude, Firecrawl, Meta Ads, HubSpot, Slack, …

Connectors without a dedicated mutation inventory entry are treated as **read-only / metadata-only** until operators extend `scripts/live-provider/mutation-inventory.mjs`.

## Commands

```bash
node scripts/live-provider/live-provider-acceptance.mjs --saas
node scripts/live-provider/live-provider-acceptance.mjs --saas --mock
node scripts/live-provider/live-provider-acceptance.mjs --connector github --mock
node scripts/live-provider/live-provider-acceptance.mjs --matrix-only
pnpm test:live-provider-acceptance
```

## Gates (B5.5C)

| Gate                                           | Effect                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| (default)                                      | Preflight + in-process mock policy; no provider HTTP                        |
| `OSVA_LIVE_PROVIDER_EXECUTE=1`                 | Allows **live read** scenarios when credentials + harness env are set       |
| `OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED=1`      | Relaxes harness **policy env** checks only; does **not** enable live writes |
| `OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED=1` | Reserved for **B5.5D** live mutation runner (disabled in B5.5C)             |
| `--mock`                                       | Runs package vitest paths listed in matrix metadata                         |

## Mutation classification

Machine-readable inventory: `scripts/live-provider/mutation-inventory.mjs`.

Classes: `READ_ONLY`, `REVERSIBLE_MUTATION`, `IRREVERSIBLE_MUTATION`, `DESTRUCTIVE`, `FINANCIALLY_SENSITIVE`, `EXTERNAL_COMMUNICATION`.

Scenarios:

- `preflight_mutation_inventory` — inventory integrity
- `mock_mutation_safety` — approval flags cannot open live mutation runner
- `mock_untrusted_content` — harness execution mode unchanged by provider-style text
- `live_mutation` — always `NOT_RUN` in B5.5C

## Limitations

- **GitHub**: without `OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES`, connector allows any repo (credential scope only); harness requires allowlist for live reads.
- **Stripe**: financially sensitive reads; customer allowlist enforced in connector when configured.
- **Live mutation**: no real writes in B5.5C regardless of env flags.

## Sandbox (operator)

See per-package README and `live-provider-acceptance-matrix.md` Required env columns. Harness-specific vars remain `OSVA_LIVE_PROVIDER_*`.

## Deferred (B5.5D)

- Live mutation runner with `OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED`
- Destructive scenario approval + cleanup evidence
