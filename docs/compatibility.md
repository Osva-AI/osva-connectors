# OSVA compatibility

This repository implements standalone connectors against public OSVA contracts.

## SDK and contracts

| Component                       | Version (M19.1 baseline)                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `@osva-ai/connector-sdk`        | **`1.1.4`** (exact pin on all connector packages)                        |
| Transitive `@osva-ai/contracts` | **`1.1.4`** (via connector-sdk)                                          |
| MCP packages (via SDK)          | `@modelcontextprotocol/node@2.1.2`, `@modelcontextprotocol/server@2.4.0` |

Published SDK versions were verified with:

```bash
pnpm view @osva-ai/connector-sdk versions --json
```

## Connector Profile V1

Connectors in this repository:

- Expose MCP `tools/list` and `tools/call`
- Support stdio transport via `serveStdio`
- Return structured JSON tool results compatible with OSVA MCP client normalization
- Propagate MCP cancellation through `AbortSignal` where supported

Reference: [CONNECTOR_PROFILE_V1.md](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md)

## Tool naming

### `@osva-ai/connector-github`

- `github.repository.get` (read-only)
- `github.issue.list` (read-only)
- `github.issue.get` (read-only)
- `github.issue.create` (mutating; C2.1)
- `github.issue.comment.create` (mutating; C2.2)

### `@osva-ai/connector-postgres`

- `postgres.connection.test` (read-only)
- `postgres.schema.list` (read-only)
- `postgres.table.list` (read-only)
- `postgres.column.list` (read-only)
- `postgres.query.read` (read-only)

### `@osva-ai/connector-shopify`

- `shopify.shop.get` (read-only)
- `shopify.product.list` (read-only)
- `shopify.product.get` (read-only)
- `shopify.order.list` (read-only)
- `shopify.order.get` (read-only)
- `shopify.inventory.levels.list` (read-only)
- `shopify.location.list` (read-only)

### `@osva-ai/connector-ga4`

- `ga4.property.list` (read-only)
- `ga4.property.get` (read-only)
- `ga4.metadata.get` (read-only)
- `ga4.report.run` (read-only)
- `ga4.report.realtime` (read-only)
- `ga4.report.acquisition` (read-only)
- `ga4.report.ecommerce` (read-only)

### `@osva-ai/connector-gsc`

- `gsc.property.list` (read-only)
- `gsc.property.get` (read-only)
- `gsc.performance.query` (read-only)
- `gsc.performance.pages` (read-only)
- `gsc.performance.queries` (read-only)
- `gsc.sitemap.list` (read-only)
- `gsc.sitemap.get` (read-only)
- `gsc.url.inspect` (read-only)

### `@osva-ai/connector-google-sheets`

- `sheets.spreadsheet.get` (read-only)
- `sheets.sheet.list` (read-only)
- `sheets.values.get` (read-only)
- `sheets.values.batchGet` (read-only)
- `sheets.values.append` (mutating; write env guard)
- `sheets.values.update` (mutating; write env guard)
- `sheets.values.batchUpdate` (mutating; write env guard)
- `sheets.sheet.add` (mutating; write env guard)

### `@osva-ai/connector-klaviyo`

- `klaviyo.account.get` (read-only)
- `klaviyo.campaign.list` (read-only)
- `klaviyo.campaign.get` (read-only)
- `klaviyo.flow.list` (read-only)
- `klaviyo.flow.get` (read-only)
- `klaviyo.metric.list` (read-only)
- `klaviyo.metric.get` (read-only)
- `klaviyo.event.list` (read-only)
- `klaviyo.report.campaign` (read-only query POST)
- `klaviyo.report.flow` (read-only query POST)

### `@osva-ai/connector-meta-ads`

- `meta.adAccount.list` (read-only)
- `meta.adAccount.get` (read-only)
- `meta.campaign.list` (read-only)
- `meta.adSet.list` (read-only)
- `meta.ad.list` (read-only)
- `meta.insights.account` (read-only)
- `meta.insights.campaign` (read-only)
- `meta.insights.adSet` (read-only)
- `meta.insights.ad` (read-only)
- `meta.insights.breakdown` (read-only)

### `@osva-ai/connector-google-ads`

- `ads.customer.list` (read-only)
- `ads.customer.get` (read-only)
- `ads.campaign.list` (read-only)
- `ads.campaign.performance` (read-only)
- `ads.adGroup.performance` (read-only)
- `ads.keyword.performance` (read-only)
- `ads.searchTerm.performance` (read-only)
- `ads.asset.performance` (read-only)
- `ads.report.query` (read-only; constrained GAQL)

### `@osva-ai/connector-google-drive`

- `drive.file.list` (read-only)
- `drive.file.get` (read-only)
- `drive.file.read` (read-only)
- `drive.file.export` (read-only)
- `drive.folder.list` (read-only)
- `drive.sharedDrive.list` (read-only)
- `drive.changes.start` (read-only)
- `drive.changes.list` (read-only)

### `@osva-ai/connector-hubspot`

- `hubspot.contact.list` (read-only)
- `hubspot.contact.get` (read-only)
- `hubspot.company.list` (read-only)
- `hubspot.company.get` (read-only)
- `hubspot.deal.list` (read-only)
- `hubspot.deal.get` (read-only)
- `hubspot.crm.search` (read-only query POST)
- `hubspot.pipeline.list` (read-only)
- `hubspot.owner.list` (read-only)
- `hubspot.association.list` (read-only)

### `@osva-ai/connector-stripe`

- `stripe.account.get` (read-only)
- `stripe.balance.get` (read-only)
- `stripe.balanceTransaction.list` (read-only)
- `stripe.paymentIntent.list` (read-only)
- `stripe.paymentIntent.get` (read-only)
- `stripe.charge.list` (read-only)
- `stripe.refund.list` (read-only)
- `stripe.subscription.list` (read-only)
- `stripe.invoice.list` (read-only)
- `stripe.customer.get` (read-only)

### `@osva-ai/connector-whatsapp`

- `whatsapp.businessAccount.get` (read-only)
- `whatsapp.phoneNumber.list` (read-only)
- `whatsapp.phoneNumber.get` (read-only)
- `whatsapp.businessProfile.get` (read-only)
- `whatsapp.template.list` (read-only)
- `whatsapp.template.get` (read-only)
- `whatsapp.analytics.get` (read-only; template analytics)
- `whatsapp.template.send` (mutating; send env + host opt-in allowlist)

### `@osva-ai/connector-slack`

- `slack.auth.test` (read-only)
- `slack.channel.list` (read-only)
- `slack.channel.info` (read-only)
- `slack.message.history` (read-only)
- `slack.message.thread` (read-only)
- `slack.message.post` (mutating; write env guard)
- `slack.message.reply` (mutating; write env guard)

Tool names use dot-separated segments and remain stable for a connector version.

## Output budgets (C3.1)

`@osva-ai/connector-github` enforces runtime output budgets on all five tools (**256 KiB UTF-8 on `JSON.stringify(structuredContent)`** per call—not the full duplicated MCP `CallToolResult`), per-field string caps, and `issuesTruncated` / `*Truncated` metadata. Additive optional fields may appear on tool results; input JSON schemas are unchanged. See [packages/github/README.md](../packages/github/README.md#output-bounds-c31).

## Node.js

Node.js 24+ is required (aligned with `@osva-ai/connector-sdk` engines).

## Release status

Verified on npm registry (`npm view <package> version`, **2026-11-06**). **Published** = installable from the public registry at the listed version. **Source-only** = implemented in this repo; use `pnpm pack` / tarball acceptance until first publish.

M19 publication inventory: [M19_PUBLICATION_RECORD.md](./M19_PUBLICATION_RECORD.md).

| Package                            | Repo version | npm latest (2026-11-06) | Status        | Notes                                                   |
| ---------------------------------- | ------------ | ----------------------- | ------------- | ------------------------------------------------------- |
| `@osva-ai/connector-github`        | `0.3.1`      | **`0.3.1`**             | **Published** | Tarball pins **`connector-sdk@1.1.4`**                  |
| `@osva-ai/connector-postgres`      | `0.1.1`      | **`0.1.1`**             | **Published** | Tarball pins **`connector-sdk@1.1.4`**                  |
| `@osva-ai/connector-shopify`       | `0.1.1`      | **`0.1.1`**             | **Published** | Tarball pins **`connector-sdk@1.1.4`**                  |
| `@osva-ai/connector-ga4`           | `0.1.1`      | **`0.1.1`**             | **Published** | Tarball pins **`connector-sdk@1.1.4`**                  |
| `@osva-ai/connector-npm`           | `0.1.1`      | **`0.1.1`**             | **Published** | **`stable-candidate`** remains **`0.1.0`** (legacy tag) |
| `@osva-ai/connector-slack`         | `0.1.0`      | **`0.1.0`**             | **Published** | M19 Wave 1 first publication                            |
| `@osva-ai/connector-stripe`        | `0.1.0`      | **`0.1.0`**             | **Published** | M19 Wave 1 first publication                            |
| `@osva-ai/connector-hubspot`       | `0.1.0`      | **`0.1.0`**             | **Published** | M19 Wave 1 first publication                            |
| `@osva-ai/connector-gsc`           | `0.1.0`      | —                       | Source-only   | Out of M19 publication scope                            |
| `@osva-ai/connector-google-drive`  | `0.1.0`      | —                       | Source-only   |                                                         |
| `@osva-ai/connector-google-sheets` | `0.1.0`      | —                       | Source-only   |                                                         |
| `@osva-ai/connector-google-ads`    | `0.1.0`      | —                       | Source-only   |                                                         |
| `@osva-ai/connector-meta-ads`      | `0.1.0`      | —                       | Source-only   |                                                         |
| `@osva-ai/connector-klaviyo`       | `0.1.0`      | —                       | Source-only   |                                                         |
| `@osva-ai/connector-whatsapp`      | `0.1.0`      | —                       | Source-only   |                                                         |

**Summary:** **8 / 15** connector packages are on the public npm registry at M19-aligned versions (**SDK 1.1.4** on published tarballs). **7 / 15** remain source-only.

### Immutable-version history (reference only)

Older semver lines (**`0.3.0`**, **`0.1.0`** on realignment packages) remain on npm with legacy SDK pins (**`1.1.0-rc.2`** / **`1.1.3`**). Prefer **`latest`** coordinates in the table above for new installs.

See [INSTALL.md](./INSTALL.md), [INSTALL-NPM.md](./INSTALL-NPM.md), [RELEASE-CHECKLIST-NPM.md](./RELEASE-CHECKLIST-NPM.md), [INSTALL-POSTGRES.md](./INSTALL-POSTGRES.md), [INSTALL-SHOPIFY.md](./INSTALL-SHOPIFY.md), [INSTALL-GA4.md](./INSTALL-GA4.md), [INSTALL-GSC.md](./INSTALL-GSC.md), [INSTALL-SLACK.md](./INSTALL-SLACK.md), [INSTALL-GOOGLE-DRIVE.md](./INSTALL-GOOGLE-DRIVE.md), [INSTALL-GOOGLE-SHEETS.md](./INSTALL-GOOGLE-SHEETS.md), [INSTALL-GOOGLE-ADS.md](./INSTALL-GOOGLE-ADS.md), [INSTALL-META-ADS.md](./INSTALL-META-ADS.md), [INSTALL-KLAVIYO.md](./INSTALL-KLAVIYO.md), [INSTALL-WHATSAPP.md](./INSTALL-WHATSAPP.md), [INSTALL-HUBSPOT.md](./INSTALL-HUBSPOT.md), [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md), [RELEASE-CHECKLIST-POSTGRES.md](./RELEASE-CHECKLIST-POSTGRES.md), [RELEASE-CHECKLIST-SHOPIFY.md](./RELEASE-CHECKLIST-SHOPIFY.md), [RELEASE-CHECKLIST-GA4.md](./RELEASE-CHECKLIST-GA4.md), [RELEASE-CHECKLIST-GSC.md](./RELEASE-CHECKLIST-GSC.md), [RELEASE-CHECKLIST-SLACK.md](./RELEASE-CHECKLIST-SLACK.md), [RELEASE-CHECKLIST-GOOGLE-DRIVE.md](./RELEASE-CHECKLIST-GOOGLE-DRIVE.md), [RELEASE-CHECKLIST-GOOGLE-SHEETS.md](./RELEASE-CHECKLIST-GOOGLE-SHEETS.md), [RELEASE-CHECKLIST-GOOGLE-ADS.md](./RELEASE-CHECKLIST-GOOGLE-ADS.md), [RELEASE-CHECKLIST-META-ADS.md](./RELEASE-CHECKLIST-META-ADS.md), [RELEASE-CHECKLIST-KLAVIYO.md](./RELEASE-CHECKLIST-KLAVIYO.md), [RELEASE-CHECKLIST-WHATSAPP.md](./RELEASE-CHECKLIST-WHATSAPP.md), [RELEASE-CHECKLIST-HUBSPOT.md](./RELEASE-CHECKLIST-HUBSPOT.md), [INSTALL-STRIPE.md](./INSTALL-STRIPE.md), [RELEASE-CHECKLIST-STRIPE.md](./RELEASE-CHECKLIST-STRIPE.md), and [M19_PUBLICATION_RECORD.md](./M19_PUBLICATION_RECORD.md).
