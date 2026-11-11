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

### `@osva-ai/connector-gmail`

- `gmail.profile.get` (read-only)
- `gmail.message.list` (read-only)
- `gmail.message.get` (read-only)
- `gmail.thread.list` (read-only)
- `gmail.thread.get` (read-only)
- `gmail.label.list` (read-only)
- `gmail.draft.list` (read-only)
- `gmail.draft.create` (mutating; drafts env + recipient allowlist)
- `gmail.draft.update` (mutating; drafts env + recipient allowlist)
- `gmail.message.send` (mutating; send env + host approval + allowlist; not auto-retried)

### `@osva-ai/connector-google-calendar`

- `calendar.calendar.list` (read-only)
- `calendar.event.list` (read-only)
- `calendar.event.get` (read-only)
- `calendar.freebusy.query` (read-only; POST to freeBusy endpoint)
- `calendar.event.create` (mutating; write env + host approval + calendar allowlist)
- `calendar.event.update` (mutating; events.patch; same gates)
- `calendar.event.delete` (mutating; same gates)

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

### `@osva-ai/connector-notion`

- `notion.search` (read-only)
- `notion.page.get` (read-only)
- `notion.block.children.list` (read-only)
- `notion.database.get` (read-only)
- `notion.datasource.get` (read-only)
- `notion.datasource.query` (read-only)
- `notion.page.create` (mutating; write env guard)
- `notion.page.update` (mutating; write env guard)
- `notion.block.children.append` (mutating; write env guard)

### `@osva-ai/connector-jira`

- `jira.project.list` (read-only)
- `jira.project.get` (read-only)
- `jira.issue.search` (read-only)
- `jira.issue.get` (read-only)
- `jira.issue.transitions.list` (read-only)
- `jira.issue.create` (mutating; write env guard)
- `jira.issue.update` (mutating; write env guard)
- `jira.issue.comment.create` (mutating; write env guard)
- `jira.issue.transition` (mutating; write env guard)

### `@osva-ai/connector-confluence`

- `confluence.space.list` (read-only)
- `confluence.space.get` (read-only)
- `confluence.page.list` (read-only)
- `confluence.page.get` (read-only)
- `confluence.search` (read-only)
- `confluence.page.children.list` (read-only)
- `confluence.page.create` (mutating; write env guard)
- `confluence.page.update` (mutating; write env guard)

### `@osva-ai/connector-outlook`

- `outlook.mailFolder.list` (read-only)
- `outlook.message.list` (read-only)
- `outlook.message.get` (read-only)
- `outlook.message.search` (read-only)
- `outlook.calendar.list` (read-only)
- `outlook.event.list` (read-only)
- `outlook.event.get` (read-only)
- `outlook.message.send` (mutating; send env guard)
- `outlook.event.create` (mutating; write env guard)

### `@osva-ai/connector-onedrive`

- `onedrive.drive.get` (read-only)
- `onedrive.item.list` (read-only)
- `onedrive.item.get` (read-only)
- `onedrive.file.read` (read-only)
- `onedrive.file.search` (read-only)
- `onedrive.file.upload.small` (mutating; write env guard)

### `@osva-ai/connector-teams`

- `teams.team.list` (read-only)
- `teams.channel.list` (read-only)
- `teams.channel.message.list` (read-only)
- `teams.channel.reply.list` (read-only)
- `teams.chat.list` (read-only)
- `teams.chat.message.list` (read-only)
- `teams.channel.message.send` (mutating; send env guard)
- `teams.chat.message.send` (mutating; send env guard)

### `@osva-ai/connector-linear`

- `linear.viewer.get` (read-only)
- `linear.team.list` (read-only)
- `linear.issue.list` (read-only)
- `linear.issue.get` (read-only)
- `linear.issue.search` (read-only)
- `linear.project.list` (read-only)
- `linear.project.get` (read-only)
- `linear.issue.create` (mutating; write env guard)
- `linear.issue.update` (mutating; write env guard)
- `linear.comment.create` (mutating; write env guard)

### `@osva-ai/connector-exa`

- `exa.search` (read-only)
- `exa.contents.get` (read-only)
- `exa.answer` (read-only; provider-generated answer with disclaimer)

### `@osva-ai/connector-tavily`

- `tavily.search` (read-only)
- `tavily.extract` (read-only)
- `tavily.crawl` (read-only; bounded crawl limits)

### `@osva-ai/connector-firecrawl`

- `firecrawl.scrape` (read-only)
- `firecrawl.search` (read-only)
- `firecrawl.map` (read-only)
- `firecrawl.crawl.start` (read-only; returns crawl ID only)
- `firecrawl.crawl.status` (read-only; poll status / paginated results)

### `@osva-ai/connector-qdrant`

- `qdrant.collection.list` (read-only)
- `qdrant.collection.get` (read-only)
- `qdrant.point.get` (read-only)
- `qdrant.point.scroll` (read-only)
- `qdrant.point.query` (read-only)
- `qdrant.point.count` (read-only)
- `qdrant.point.upsert` (mutating; gated)

### `@osva-ai/connector-pinecone`

- `pinecone.index.list` (read-only)
- `pinecone.index.describe` (read-only)
- `pinecone.index.stats` (read-only)
- `pinecone.vector.query` (read-only; dense indexes only)
- `pinecone.vector.fetch` (read-only)
- `pinecone.vector.list` (read-only)
- `pinecone.vector.upsert` (mutating; gated; dense indexes only)

### `@osva-ai/connector-mixpanel`

- `mixpanel.report.get` (read-only)
- `mixpanel.segmentation.run` (read-only)
- `mixpanel.funnel.get` (read-only)
- `mixpanel.retention.run` (read-only)
- `mixpanel.cohort.list` (read-only)
- `mixpanel.event.top` (read-only)

### `@osva-ai/connector-amplitude`

- `amplitude.event.list` (read-only)
- `amplitude.event.segmentation` (read-only)
- `amplitude.funnel.run` (read-only)
- `amplitude.retention.run` (read-only)
- `amplitude.user.active` (read-only; aggregate series only)
- `amplitude.chart.get` (read-only)
- `amplitude.session.average` (read-only)

### `@osva-ai/connector-zendesk`

- `zendesk.ticket.list` / `get` / `search` / `conversation.list` (read-only)
- `zendesk.user.list` / `get` (read-only)
- `zendesk.ticket.comment.add` / `ticket.status.set` (mutating; gated)

### `@osva-ai/connector-intercom`

- `intercom.conversation.list` / `get` / `search` (read-only)
- `intercom.contact.list` / `get` / `search` (read-only)
- `intercom.admin.list` (read-only)
- `intercom.conversation.note.add` / `conversation.state.set` (mutating; gated)

### `@osva-ai/connector-freshdesk`

- `freshdesk.ticket.list` / `get` / `search` / `conversation.list` (read-only)
- `freshdesk.contact.list` / `get` (read-only)
- `freshdesk.ticket.note.add` / `ticket.status.set` (mutating; gated)

### `@osva-ai/connector-salesforce` (B4.7)

- `salesforce.account.list` / `get`, `contact.list` / `get`, `opportunity.list` / `get`, `opportunity.stage.list` (read-only)
- `salesforce.opportunity.stage.set`, `task.create` (mutating; gated)

### `@osva-ai/connector-pipedrive` (B4.7)

- `pipedrive.pipeline.list`, `stage.list`, `deal.list` / `get` / `search`, `person.list` / `get`, `organization.list` / `get` (read-only)
- `pipedrive.deal.stage.set` (mutating; gated)

### `@osva-ai/connector-zoho-crm` (B4.7)

- `zoho.lead.list` / `get`, `account.list` / `get`, `contact.list` / `get`, `deal.list` / `get`, `deal.stage.list` (read-only)
- `zoho.deal.stage.set`, `deal.note.add` (mutating; gated)

### `@osva-ai/connector-aws-s3` (B4.8)

- `s3.bucket.list`, `s3.bucket.get`, `s3.object.list`, `s3.object.metadata.get`, `s3.object.text.read`, `s3.object.versions.list` (read-only)
- `s3.object.text.create`, `s3.object.text.replace` (mutating; gated)

### `@osva-ai/connector-gcs` (B4.8)

- `gcs.bucket.list`, `gcs.bucket.get`, `gcs.object.list`, `gcs.object.metadata.get`, `gcs.object.text.read`, `gcs.object.versions.list` (read-only)
- `gcs.object.text.create`, `gcs.object.text.replace` (mutating; gated)

### `@osva-ai/connector-azure-blob` (B4.8)

- `azureblob.container.list`, `azureblob.container.get`, `azureblob.blob.list`, `azureblob.blob.metadata.get`, `azureblob.blob.text.read`, `azureblob.blob.versions.list` (read-only)
- `azureblob.blob.text.create`, `azureblob.blob.text.replace` (mutating; gated)

### `@osva-ai/connector-bigquery` (B4.9)

- `bigquery.project.get`, `bigquery.dataset.list`, `bigquery.dataset.get`, `bigquery.table.list`, `bigquery.table.get`, `bigquery.table.columns.list`, `bigquery.table.rows.sample`, `bigquery.table.aggregate` (read-only)

### `@osva-ai/connector-snowflake` (B4.9)

- `snowflake.database.get`, `snowflake.schema.list`, `snowflake.schema.get`, `snowflake.table.list`, `snowflake.table.get`, `snowflake.table.columns.list`, `snowflake.table.rows.sample`, `snowflake.table.aggregate` (read-only)

### `@osva-ai/connector-supabase` (B4.9)

- `supabase.project.get`, `supabase.schema.list`, `supabase.table.list`, `supabase.table.get`, `supabase.table.columns.list`, `supabase.table.rows.list`, `supabase.table.row.get`, `supabase.table.rows.count` (read-only)

Tool names use dot-separated segments and remain stable for a connector version.

## Output budgets (C3.1)

`@osva-ai/connector-github` enforces runtime output budgets on all five tools (**256 KiB UTF-8 on `JSON.stringify(structuredContent)`** per call—not the full duplicated MCP `CallToolResult`), per-field string caps, and `issuesTruncated` / `*Truncated` metadata. Additive optional fields may appear on tool results; input JSON schemas are unchanged. See [packages/github/README.md](../packages/github/README.md#output-bounds-c31).

## Node.js

Node.js 24+ is required (aligned with `@osva-ai/connector-sdk` engines).

## Release status

**B5.6A (2026-11-11):** All **45** workspace connector packages are **published** on the public npm registry. Workspace `package.json` versions match registry targets verified in [release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md](./release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md).

**Machine-readable inventory:** [connector-catalog.json](./connector-catalog.json) (`pnpm generate:connector-catalog`). Each entry includes `publishedVersion`, install guide path, credential env names, and read-only vs mutation-capable tool lists derived from the mutation inventory generator.

Historical publication waves: [M19_PUBLICATION_RECORD.md](./M19_PUBLICATION_RECORD.md), [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md).

### Version matrix

The full per-package version list is maintained in [connector-catalog.json](./connector-catalog.json) (`publishedVersion` on all **45** entries) and [release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md](./release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md) §4.

**Summary:** **45 / 45** connector packages are on the public npm registry at workspace versions (B5.6 published-artifact verification). That gate validates isolated npm install, binary shims, and **mocked** MCP smoke — not live-provider sandbox coverage for every integration.

Per-connector install: `docs/INSTALL*.md` and [CONNECTOR_QUICKSTART.md](./CONNECTOR_QUICKSTART.md).

### Immutable-version history (reference only)

Older semver lines (**`0.3.x`** GitHub, **`0.1.0`** on realignment packages) remain on npm with legacy SDK pins (**`1.1.0-rc.2`** / **`1.1.3`**). Prefer catalog `publishedVersion` coordinates for new installs (GitHub **`0.4.0`**, npm connector **`0.1.1`**, etc.).

See [INSTALL.md](./INSTALL.md), [INSTALL-NPM.md](./INSTALL-NPM.md), [RELEASE-CHECKLIST-NPM.md](./RELEASE-CHECKLIST-NPM.md), [INSTALL-POSTGRES.md](./INSTALL-POSTGRES.md), [INSTALL-SHOPIFY.md](./INSTALL-SHOPIFY.md), [INSTALL-GA4.md](./INSTALL-GA4.md), [INSTALL-GSC.md](./INSTALL-GSC.md), [INSTALL-SLACK.md](./INSTALL-SLACK.md), [INSTALL-GOOGLE-DRIVE.md](./INSTALL-GOOGLE-DRIVE.md), [INSTALL-GMAIL.md](./INSTALL-GMAIL.md), [INSTALL-GOOGLE-CALENDAR.md](./INSTALL-GOOGLE-CALENDAR.md), [INSTALL-GOOGLE-SHEETS.md](./INSTALL-GOOGLE-SHEETS.md), [INSTALL-GOOGLE-ADS.md](./INSTALL-GOOGLE-ADS.md), [INSTALL-META-ADS.md](./INSTALL-META-ADS.md), [INSTALL-KLAVIYO.md](./INSTALL-KLAVIYO.md), [INSTALL-WHATSAPP.md](./INSTALL-WHATSAPP.md), [INSTALL-HUBSPOT.md](./INSTALL-HUBSPOT.md), [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md), [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md), [RELEASE-CHECKLIST-POSTGRES.md](./RELEASE-CHECKLIST-POSTGRES.md), [RELEASE-CHECKLIST-SHOPIFY.md](./RELEASE-CHECKLIST-SHOPIFY.md), [RELEASE-CHECKLIST-GA4.md](./RELEASE-CHECKLIST-GA4.md), [RELEASE-CHECKLIST-GSC.md](./RELEASE-CHECKLIST-GSC.md), [RELEASE-CHECKLIST-SLACK.md](./RELEASE-CHECKLIST-SLACK.md), [RELEASE-CHECKLIST-GOOGLE-DRIVE.md](./RELEASE-CHECKLIST-GOOGLE-DRIVE.md), [RELEASE-CHECKLIST-GMAIL.md](./RELEASE-CHECKLIST-GMAIL.md), [RELEASE-CHECKLIST-GOOGLE-CALENDAR.md](./RELEASE-CHECKLIST-GOOGLE-CALENDAR.md), [RELEASE-CHECKLIST-GOOGLE-SHEETS.md](./RELEASE-CHECKLIST-GOOGLE-SHEETS.md), [RELEASE-CHECKLIST-GOOGLE-ADS.md](./RELEASE-CHECKLIST-GOOGLE-ADS.md), [RELEASE-CHECKLIST-META-ADS.md](./RELEASE-CHECKLIST-META-ADS.md), [RELEASE-CHECKLIST-KLAVIYO.md](./RELEASE-CHECKLIST-KLAVIYO.md), [RELEASE-CHECKLIST-WHATSAPP.md](./RELEASE-CHECKLIST-WHATSAPP.md), [RELEASE-CHECKLIST-HUBSPOT.md](./RELEASE-CHECKLIST-HUBSPOT.md), [INSTALL-STRIPE.md](./INSTALL-STRIPE.md), [RELEASE-CHECKLIST-STRIPE.md](./RELEASE-CHECKLIST-STRIPE.md), [INSTALL-MIXPANEL.md](./INSTALL-MIXPANEL.md), [INSTALL-AMPLITUDE.md](./INSTALL-AMPLITUDE.md), [RELEASE-CHECKLIST-MIXPANEL.md](./RELEASE-CHECKLIST-MIXPANEL.md), [RELEASE-CHECKLIST-AMPLITUDE.md](./RELEASE-CHECKLIST-AMPLITUDE.md), and [M19_PUBLICATION_RECORD.md](./M19_PUBLICATION_RECORD.md).
