# osva-connectors

Official OSVA connector packages built on the public [`@osva-ai/connector-sdk`](https://www.npmjs.com/package/@osva-ai/connector-sdk) and [Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md).

This monorepo contains **33** connector packages. As of **2026-11-08** (`npm view`), **22** are published on the public npm registry (**SDK `1.1.4`** on current `latest` lines); **Jira**, **Confluence**, **Outlook**, **OneDrive**, **Teams**, **WooCommerce**, and **BigCommerce** are source-only at `@0.1.0`. B3 bootstrap record: [docs/B3_PUBLICATION_RECORD.md](./docs/B3_PUBLICATION_RECORD.md). M19 history: [docs/M19_PUBLICATION_RECORD.md](./docs/M19_PUBLICATION_RECORD.md). See [docs/compatibility.md](./docs/compatibility.md#release-status).

## `@osva-ai/connector-github`

MCP **stdio** connector for GitHub: repository and issue **read**, **issue create**, and **issue comment create**.

| Requirement | Value                                                                |
| ----------- | -------------------------------------------------------------------- |
| Node.js     | **24+**                                                              |
| npm package | `@osva-ai/connector-github` (see [install guide](./docs/INSTALL.md)) |
| Credential  | `OSVA_CONNECTOR_GITHUB_TOKEN` (fine-grained GitHub PAT)              |
| Binary      | `osva-connector-github` → MCP stdio server                           |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-github@0.3.1
```

Full quickstart (PowerShell and bash, token scopes, MCP host JSON, tool examples): **[docs/INSTALL.md](./docs/INSTALL.md)**.

Tool reference, mutation retry semantics, output budgets, and security notes: **[packages/github/README.md](./packages/github/README.md)**.

## `@osva-ai/connector-postgres`

MCP **stdio** connector for PostgreSQL: connection test, schema/table/column **discovery**, and bounded **read-only SELECT** (`postgres.query.read`).

| Requirement | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                         |
| npm package | `@osva-ai/connector-postgres` (see [install guide](./docs/INSTALL-POSTGRES.md)) |
| Credential  | `OSVA_CONNECTOR_POSTGRES_URL`                                                   |
| Binary      | `osva-connector-postgres` → MCP stdio server                                    |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-postgres@0.1.1
```

Full quickstart (TLS, least-privilege role, MCP host JSON, five tools, timeouts): **[docs/INSTALL-POSTGRES.md](./docs/INSTALL-POSTGRES.md)**.

Tool reference, SQL admission, output budgets, and security notes: **[packages/postgres/README.md](./packages/postgres/README.md)**.

## `@osva-ai/connector-ga4`

MCP **stdio** connector for Google Analytics 4: property **discovery**, reporting **metadata**, and bounded **read-only** core, realtime, acquisition, and ecommerce reports.

| Requirement | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Node.js     | **24+**                                                               |
| npm package | `@osva-ai/connector-ga4` (see [install guide](./docs/INSTALL-GA4.md)) |
| Credential  | Google ADC or service account (`GOOGLE_APPLICATION_CREDENTIALS`)      |
| Binary      | `osva-connector-ga4` → MCP stdio server                               |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-ga4@0.1.1
```

Full quickstart (Google Cloud APIs, property access, MCP host JSON, seven tools, pagination): **[docs/INSTALL-GA4.md](./docs/INSTALL-GA4.md)**.

Tool reference, quotas, output budgets, and security notes: **[packages/ga4/README.md](./packages/ga4/README.md)**.

## `@osva-ai/connector-gsc`

MCP **stdio** connector for Google Search Console: property **discovery**, **Search Analytics**, **sitemaps**, and **URL Inspection** (read-only).

| Requirement | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Node.js     | **24+**                                                               |
| npm package | `@osva-ai/connector-gsc` (see [install guide](./docs/INSTALL-GSC.md)) |
| Credential  | Google ADC or service account (`GOOGLE_APPLICATION_CREDENTIALS`)      |
| Binary      | `osva-connector-gsc` → MCP stdio server                               |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-gsc@0.1.0
```

Quickstart: **[docs/INSTALL-GSC.md](./docs/INSTALL-GSC.md)**. Tool reference: **[packages/gsc/README.md](./packages/gsc/README.md)**.

## `@osva-ai/connector-google-drive`

MCP **stdio** connector for Google Drive: file and folder **discovery**, **metadata**, bounded **text read**, Workspace **export**, **shared drives**, and **change tracking** (read-only).

| Requirement | Value                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                                 |
| npm package | `@osva-ai/connector-google-drive` (see [install guide](./docs/INSTALL-GOOGLE-DRIVE.md)) |
| Credential  | Google ADC or service account (`GOOGLE_APPLICATION_CREDENTIALS`)                        |
| Binary      | `osva-connector-google-drive` → MCP stdio server                                        |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-google-drive@0.1.0
```

Quickstart: **[docs/INSTALL-GOOGLE-DRIVE.md](./docs/INSTALL-GOOGLE-DRIVE.md)**. Tool reference: **[packages/google-drive/README.md](./packages/google-drive/README.md)**.

## `@osva-ai/connector-gmail`

MCP **stdio** connector for Gmail: profile and mailbox **reads**, **labels**, draft listing, and **plain-text draft / send** tools when explicitly enabled and allowlisted by the host.

| Requirement | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                     |
| npm package | `@osva-ai/connector-gmail` (see [install guide](./docs/INSTALL-GMAIL.md))   |
| Credential  | Host OAuth access token (`OSVA_CONNECTOR_GMAIL_ACCESS_TOKEN`) or Google ADC |
| Binary      | `osva-connector-gmail` → MCP stdio server                                   |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-gmail@0.1.0
```

Quickstart: **[docs/INSTALL-GMAIL.md](./docs/INSTALL-GMAIL.md)**. Tool reference: **[packages/gmail/README.md](./packages/gmail/README.md)**.

## `@osva-ai/connector-google-calendar`

MCP **stdio** connector for Google Calendar: calendar **discovery**, bounded **event** and **free/busy** reads, and **event mutations** when explicitly enabled with a calendar allowlist.

| Requirement | Value                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                                       |
| npm package | `@osva-ai/connector-google-calendar` (see [install guide](./docs/INSTALL-GOOGLE-CALENDAR.md)) |
| Credential  | Host OAuth access token or Google ADC                                                         |
| Binary      | `osva-connector-google-calendar` → MCP stdio server                                           |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-google-calendar@0.1.0
```

Quickstart: **[docs/INSTALL-GOOGLE-CALENDAR.md](./docs/INSTALL-GOOGLE-CALENDAR.md)**. Tool reference: **[packages/google-calendar/README.md](./packages/google-calendar/README.md)**.

## `@osva-ai/connector-google-sheets`

MCP **stdio** connector for Google Sheets: spreadsheet **metadata**, bounded **value reads**, and controlled **RAW writes** when explicitly enabled.

| Requirement | Value                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                                   |
| npm package | `@osva-ai/connector-google-sheets` (see [install guide](./docs/INSTALL-GOOGLE-SHEETS.md)) |
| Credential  | Google ADC or service account (`GOOGLE_APPLICATION_CREDENTIALS`)                          |
| Binary      | `osva-connector-google-sheets` → MCP stdio server                                         |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-google-sheets@0.1.0
```

Quickstart: **[docs/INSTALL-GOOGLE-SHEETS.md](./docs/INSTALL-GOOGLE-SHEETS.md)**. Tool reference: **[packages/google-sheets/README.md](./packages/google-sheets/README.md)**.

## `@osva-ai/connector-google-ads`

MCP **stdio** connector for Google Ads: **customer discovery**, bounded **performance reporting**, and **constrained GAQL** (read-only; no mutations).

| Requirement | Value                                                                               |
| ----------- | ----------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                             |
| npm package | `@osva-ai/connector-google-ads` (see [install guide](./docs/INSTALL-GOOGLE-ADS.md)) |
| Credential  | Google ADC or service account (`GOOGLE_APPLICATION_CREDENTIALS`)                    |
| Binary      | `osva-connector-google-ads` → MCP stdio server                                      |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-google-ads@0.1.0
```

Quickstart: **[docs/INSTALL-GOOGLE-ADS.md](./docs/INSTALL-GOOGLE-ADS.md)**. Tool reference: **[packages/google-ads/README.md](./packages/google-ads/README.md)**.

## `@osva-ai/connector-meta-ads`

MCP **stdio** connector for Meta Marketing API: **ad account discovery**, **campaign structure**, and bounded **Insights** (read-only; no mutations).

| Requirement | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                         |
| npm package | `@osva-ai/connector-meta-ads` (see [install guide](./docs/INSTALL-META-ADS.md)) |
| Credential  | `OSVA_CONNECTOR_META_ADS_ACCESS_TOKEN` (`ads_read`)                             |
| Binary      | `osva-connector-meta-ads` → MCP stdio server                                    |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-meta-ads@0.1.0
```

Quickstart: **[docs/INSTALL-META-ADS.md](./docs/INSTALL-META-ADS.md)**. Tool reference: **[packages/meta-ads/README.md](./packages/meta-ads/README.md)**.

## `@osva-ai/connector-klaviyo`

MCP **stdio** connector for Klaviyo: **account**, **campaigns**, **flows**, **metrics**, bounded **events**, and **Reporting API** values reports (read-only; reporting uses query POST only).

| Requirement | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                       |
| npm package | `@osva-ai/connector-klaviyo` (see [install guide](./docs/INSTALL-KLAVIYO.md)) |
| Credential  | `OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY`                                      |
| Binary      | `osva-connector-klaviyo` → MCP stdio server                                   |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-klaviyo@0.1.0
```

Quickstart: **[docs/INSTALL-KLAVIYO.md](./docs/INSTALL-KLAVIYO.md)**. Tool reference: **[packages/klaviyo/README.md](./packages/klaviyo/README.md)**.

## `@osva-ai/connector-whatsapp`

MCP **stdio** connector for WhatsApp Business Cloud API: WABA and phone **discovery**, **templates**, **template analytics**, and **guarded template send** (disabled by default; host opt-in allowlist).

| Requirement | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                         |
| npm package | `@osva-ai/connector-whatsapp` (see [install guide](./docs/INSTALL-WHATSAPP.md)) |
| Credential  | `OSVA_CONNECTOR_WHATSAPP_ACCESS_TOKEN` (+ WABA and phone number IDs)            |
| Binary      | `osva-connector-whatsapp` → MCP stdio server                                    |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-whatsapp@0.1.0
```

Quickstart: **[docs/INSTALL-WHATSAPP.md](./docs/INSTALL-WHATSAPP.md)**. Tool reference: **[packages/whatsapp/README.md](./packages/whatsapp/README.md)**.

## `@osva-ai/connector-hubspot`

MCP **stdio** connector for HubSpot CRM: **contacts**, **companies**, **deals**, structured **search**, **pipelines**, **owners**, and **associations** (read-only; search uses query POST only).

| Requirement | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                       |
| npm package | `@osva-ai/connector-hubspot` (see [install guide](./docs/INSTALL-HUBSPOT.md)) |
| Credential  | `OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN`                                         |
| Binary      | `osva-connector-hubspot` → MCP stdio server                                   |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-hubspot@0.1.0
```

Quickstart: **[docs/INSTALL-HUBSPOT.md](./docs/INSTALL-HUBSPOT.md)**. Tool reference: **[packages/hubspot/README.md](./packages/hubspot/README.md)**.

## `@osva-ai/connector-notion`

MCP **stdio** connector for Notion: **search**, **pages**, **databases**, **data sources**, **block children**, and gated **page/block mutations**.

| Requirement | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                     |
| npm package | `@osva-ai/connector-notion` (see [install guide](./docs/INSTALL-NOTION.md)) |
| Credential  | `OSVA_CONNECTOR_NOTION_ACCESS_TOKEN`                                        |
| Binary      | `osva-connector-notion` → MCP stdio server                                  |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-notion@0.1.0
```

Quickstart: **[docs/INSTALL-NOTION.md](./docs/INSTALL-NOTION.md)**. Tool reference: **[packages/notion/README.md](./packages/notion/README.md)**.

## `@osva-ai/connector-linear`

MCP **stdio** connector for Linear: **viewer**, **teams**, **issues**, **search**, **projects**, and gated **issue/comment mutations**.

| Requirement | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                     |
| npm package | `@osva-ai/connector-linear` (see [install guide](./docs/INSTALL-LINEAR.md)) |
| Credential  | `OSVA_CONNECTOR_LINEAR_API_KEY` and/or `OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN` |
| Binary      | `osva-connector-linear` → MCP stdio server                                  |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-linear@0.1.0
```

Quickstart: **[docs/INSTALL-LINEAR.md](./docs/INSTALL-LINEAR.md)**. Tool reference: **[packages/linear/README.md](./packages/linear/README.md)**.

## `@osva-ai/connector-jira`

MCP **stdio** connector for Jira Cloud: bounded **project** and **issue** reads (JQL via `search/jql`), transition discovery, and gated **issue mutations**.

| Requirement | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                         |
| npm package | `@osva-ai/connector-jira` (see [install guide](./docs/INSTALL-JIRA.md))         |
| Credential  | Site URL + email/API token, site URL + access token, or cloud ID + access token |
| Binary      | `osva-connector-jira` → MCP stdio server                                        |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-jira@0.1.0
```

Quickstart: **[docs/INSTALL-JIRA.md](./docs/INSTALL-JIRA.md)**. Tool reference: **[packages/jira/README.md](./packages/jira/README.md)**.

## `@osva-ai/connector-confluence`

MCP **stdio** connector for Confluence Cloud: bounded **space** and **page** reads, **CQL search**, child page listing, and gated **page mutations**.

| Requirement | Value                                                                               |
| ----------- | ----------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                             |
| npm package | `@osva-ai/connector-confluence` (see [install guide](./docs/INSTALL-CONFLUENCE.md)) |
| Credential  | Site URL + email/API token, site URL + access token, or cloud ID + access token     |
| Binary      | `osva-connector-confluence` → MCP stdio server                                      |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-confluence@0.1.0
```

Quickstart: **[docs/INSTALL-CONFLUENCE.md](./docs/INSTALL-CONFLUENCE.md)**. Tool reference: **[packages/confluence/README.md](./packages/confluence/README.md)**.

## `@osva-ai/connector-outlook`

MCP **stdio** connector for Microsoft Outlook (Graph delegated `/me`): **mail folders**, **messages**, **calendar** reads, **message search**, and gated **send** / **event create**.

| Requirement | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                       |
| npm package | `@osva-ai/connector-outlook` (see [install guide](./docs/INSTALL-OUTLOOK.md)) |
| Credential  | `OSVA_CONNECTOR_OUTLOOK_ACCESS_TOKEN` (delegated Graph token from host)       |
| Binary      | `osva-connector-outlook` → MCP stdio server                                   |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-outlook@0.1.0
```

Quickstart: **[docs/INSTALL-OUTLOOK.md](./docs/INSTALL-OUTLOOK.md)**. Tool reference: **[packages/outlook/README.md](./packages/outlook/README.md)**.

## `@osva-ai/connector-onedrive`

MCP **stdio** connector for OneDrive via **Microsoft Graph**: **drive** metadata, **folder listing**, **file read** (bounded text), **search**, and gated **small file upload**.

| Requirement | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                         |
| npm package | `@osva-ai/connector-onedrive` (see [install guide](./docs/INSTALL-ONEDRIVE.md)) |
| Credential  | `OSVA_CONNECTOR_ONEDRIVE_ACCESS_TOKEN` (delegated Graph token from host)        |
| Binary      | `osva-connector-onedrive` → MCP stdio server                                    |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-onedrive@0.1.0
```

Quickstart: **[docs/INSTALL-ONEDRIVE.md](./docs/INSTALL-ONEDRIVE.md)**. Tool reference: **[packages/onedrive/README.md](./packages/onedrive/README.md)**.

## `@osva-ai/connector-teams`

MCP **stdio** connector for Microsoft Teams (Graph delegated): **teams**, **channels**, **chats**, **messages** / **replies** reads, and gated **channel** / **chat** sends.

| Requirement | Value                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                   |
| npm package | `@osva-ai/connector-teams` (see [install guide](./docs/INSTALL-TEAMS.md)) |
| Credential  | `OSVA_CONNECTOR_TEAMS_ACCESS_TOKEN` (delegated Graph token from host)     |
| Binary      | `osva-connector-teams` → MCP stdio server                                 |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-teams@0.1.0
```

Quickstart: **[docs/INSTALL-TEAMS.md](./docs/INSTALL-TEAMS.md)**. Tool reference: **[packages/teams/README.md](./packages/teams/README.md)**.

## `@osva-ai/connector-exa`

MCP **stdio** connector for Exa: **web search**, **URL contents**, and **grounded answers** (provider-generated; not independently verified).

| Requirement | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Node.js     | **24+**                                                               |
| npm package | `@osva-ai/connector-exa` (see [install guide](./docs/INSTALL-EXA.md)) |
| Credential  | `OSVA_CONNECTOR_EXA_API_KEY`                                          |
| Binary      | `osva-connector-exa` → MCP stdio server                               |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-exa@0.1.0
```

Quickstart: **[docs/INSTALL-EXA.md](./docs/INSTALL-EXA.md)**. Tool reference: **[packages/exa/README.md](./packages/exa/README.md)**.

## `@osva-ai/connector-tavily`

MCP **stdio** connector for Tavily: **search**, **extract**, and **bounded crawl** (provider-side egress; conservative client limits).

| Requirement | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                     |
| npm package | `@osva-ai/connector-tavily` (see [install guide](./docs/INSTALL-TAVILY.md)) |
| Credential  | `OSVA_CONNECTOR_TAVILY_API_KEY`                                             |
| Binary      | `osva-connector-tavily` → MCP stdio server                                  |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-tavily@0.1.0
```

Quickstart: **[docs/INSTALL-TAVILY.md](./docs/INSTALL-TAVILY.md)**. Tool reference: **[packages/tavily/README.md](./packages/tavily/README.md)**.

## `@osva-ai/connector-firecrawl`

MCP **stdio** connector for Firecrawl **v2**: **scrape**, **search**, **map**, and **async crawl** (`crawl.start` / `crawl.status`).

| Requirement | Value                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                           |
| npm package | `@osva-ai/connector-firecrawl` (see [install guide](./docs/INSTALL-FIRECRAWL.md)) |
| Credential  | `OSVA_CONNECTOR_FIRECRAWL_API_KEY`                                                |
| Binary      | `osva-connector-firecrawl` → MCP stdio server                                     |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-firecrawl@0.1.0
```

Quickstart: **[docs/INSTALL-FIRECRAWL.md](./docs/INSTALL-FIRECRAWL.md)**. Tool reference: **[packages/firecrawl/README.md](./packages/firecrawl/README.md)**.

## `@osva-ai/connector-qdrant`

MCP **stdio** connector for Qdrant: **collection** list/get, **point** get/scroll/query/count, and gated **upsert**.

| Requirement | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                     |
| npm package | `@osva-ai/connector-qdrant` (see [install guide](./docs/INSTALL-QDRANT.md)) |
| Config      | `OSVA_CONNECTOR_QDRANT_URL`, optional `OSVA_CONNECTOR_QDRANT_API_KEY`       |
| Binary      | `osva-connector-qdrant` → MCP stdio server                                  |

Quickstart: **[docs/INSTALL-QDRANT.md](./docs/INSTALL-QDRANT.md)**. Tool reference: **[packages/qdrant/README.md](./packages/qdrant/README.md)**.

## `@osva-ai/connector-pinecone`

MCP **stdio** connector for Pinecone: **index** list/describe/stats, **vector** query/fetch/list, and gated **upsert** (dense indexes only).

| Requirement | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                         |
| npm package | `@osva-ai/connector-pinecone` (see [install guide](./docs/INSTALL-PINECONE.md)) |
| Credential  | `OSVA_CONNECTOR_PINECONE_API_KEY`                                               |
| Binary      | `osva-connector-pinecone` → MCP stdio server                                    |

Quickstart: **[docs/INSTALL-PINECONE.md](./docs/INSTALL-PINECONE.md)**. Tool reference: **[packages/pinecone/README.md](./packages/pinecone/README.md)**.

## `@osva-ai/connector-mixpanel`

MCP **stdio** connector for Mixpanel Query API: **Insights** saved reports, **segmentation**, **funnels**, **retention**, **cohorts**, and **top events** (read-only).

| Requirement | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                         |
| npm package | `@osva-ai/connector-mixpanel` (see [install guide](./docs/INSTALL-MIXPANEL.md)) |
| Credentials | Mixpanel service account + project ID (`OSVA_CONNECTOR_MIXPANEL_*`)             |
| Binary      | `osva-connector-mixpanel` → MCP stdio server                                    |

Quickstart: **[docs/INSTALL-MIXPANEL.md](./docs/INSTALL-MIXPANEL.md)**. Tool reference: **[packages/mixpanel/README.md](./packages/mixpanel/README.md)**.

## `@osva-ai/connector-amplitude`

MCP **stdio** connector for Amplitude Dashboard REST: **events**, **segmentation**, **funnels**, **retention**, **active users**, **saved charts**, and **session averages** (read-only).

| Requirement | Value                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                           |
| npm package | `@osva-ai/connector-amplitude` (see [install guide](./docs/INSTALL-AMPLITUDE.md)) |
| Credentials | Project API key + secret (`OSVA_CONNECTOR_AMPLITUDE_*`)                           |
| Binary      | `osva-connector-amplitude` → MCP stdio server                                     |

Quickstart: **[docs/INSTALL-AMPLITUDE.md](./docs/INSTALL-AMPLITUDE.md)**. Tool reference: **[packages/amplitude/README.md](./packages/amplitude/README.md)**.

## `@osva-ai/connector-woocommerce`

MCP **stdio** connector for WooCommerce REST **v3**: **products**, **variations**, **categories**, **orders**, and **order notes** with host ID allowlists and gated **product** / **order status** updates.

| Requirement | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                               |
| npm package | `@osva-ai/connector-woocommerce` (see [install guide](./docs/INSTALL-WOOCOMMERCE.md)) |
| Credentials | Store URL + WooCommerce REST consumer key/secret (`OSVA_CONNECTOR_WOOCOMMERCE_*`)     |
| Binary      | `osva-connector-woocommerce` → MCP stdio server                                       |

Quickstart: **[docs/INSTALL-WOOCOMMERCE.md](./docs/INSTALL-WOOCOMMERCE.md)**. Tool reference: **[packages/woocommerce/README.md](./packages/woocommerce/README.md)**.

## `@osva-ai/connector-bigcommerce`

MCP **stdio** connector for BigCommerce Admin **Catalog v3** + **Orders v2**: **products**, **variants**, **category trees**, **orders**, and gated **product** / **order status** updates.

| Requirement | Value                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                               |
| npm package | `@osva-ai/connector-bigcommerce` (see [install guide](./docs/INSTALL-BIGCOMMERCE.md)) |
| Credentials | Store hash + API token (`OSVA_CONNECTOR_BIGCOMMERCE_*`)                               |
| Binary      | `osva-connector-bigcommerce` → MCP stdio server                                       |

Quickstart: **[docs/INSTALL-BIGCOMMERCE.md](./docs/INSTALL-BIGCOMMERCE.md)**. Tool reference: **[packages/bigcommerce/README.md](./packages/bigcommerce/README.md)**.

## `@osva-ai/connector-zendesk`

MCP **stdio** connector for Zendesk Support: bounded **ticket** reads/search, **comments**, **users**, and gated **private notes** / **status** updates.

| Requirement | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                       |
| npm package | `@osva-ai/connector-zendesk` (see [install guide](./docs/INSTALL-ZENDESK.md)) |
| Credentials | Subdomain + agent email + API token (`OSVA_CONNECTOR_ZENDESK_*`)              |
| Binary      | `osva-connector-zendesk` → MCP stdio server                                   |

Quickstart: **[docs/INSTALL-ZENDESK.md](./docs/INSTALL-ZENDESK.md)**. Tool reference: **[packages/zendesk/README.md](./packages/zendesk/README.md)**.

## `@osva-ai/connector-intercom`

MCP **stdio** connector for Intercom: **conversations**, **contacts**, **admins**, and gated **admin notes** / **open-closed state** updates (`Intercom-Version: 2.17`).

| Requirement | Value                                                                           |
| ----------- | ------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                         |
| npm package | `@osva-ai/connector-intercom` (see [install guide](./docs/INSTALL-INTERCOM.md)) |
| Credentials | Access token, region (`us`/`eu`/`au`), admin id (`OSVA_CONNECTOR_INTERCOM_*`)   |
| Binary      | `osva-connector-intercom` → MCP stdio server                                    |

Quickstart: **[docs/INSTALL-INTERCOM.md](./docs/INSTALL-INTERCOM.md)**. Tool reference: **[packages/intercom/README.md](./packages/intercom/README.md)**.

## `@osva-ai/connector-freshdesk`

MCP **stdio** connector for Freshdesk: bounded **ticket**/**contact** reads/search, **conversations**, and gated **private notes** / **status** updates.

| Requirement | Value                                                                             |
| ----------- | --------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                           |
| npm package | `@osva-ai/connector-freshdesk` (see [install guide](./docs/INSTALL-FRESHDESK.md)) |
| Credentials | Domain + API key (`OSVA_CONNECTOR_FRESHDESK_*`)                                   |
| Binary      | `osva-connector-freshdesk` → MCP stdio server                                     |

Quickstart: **[docs/INSTALL-FRESHDESK.md](./docs/INSTALL-FRESHDESK.md)**. Tool reference: **[packages/freshdesk/README.md](./packages/freshdesk/README.md)**.

## `@osva-ai/connector-salesforce`

MCP **stdio** connector for Salesforce CRM: **Account** / **Contact** / **Opportunity** reads, **opportunity stage** discovery, and gated **stage updates** and **Task** creation (fixed SOQL templates only).

| Requirement | Value                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                                           |
| npm package | `@osva-ai/connector-salesforce` (source-only; [INSTALL-SALESFORCE](./docs/INSTALL-SALESFORCE.md)) |
| Credentials | Instance URL + OAuth access token (`OSVA_CONNECTOR_SALESFORCE_*`)                                 |
| Binary      | `osva-connector-salesforce` → MCP stdio server                                                    |

## `@osva-ai/connector-pipedrive`

MCP **stdio** connector for Pipedrive API v2: **pipelines**, **stages**, **deals**, **persons**, **organizations**, and gated **deal stage** updates.

| Requirement | Value                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                                        |
| npm package | `@osva-ai/connector-pipedrive` (source-only; [INSTALL-PIPEDRIVE](./docs/INSTALL-PIPEDRIVE.md)) |
| Credentials | Company domain + API token (`OSVA_CONNECTOR_PIPEDRIVE_*`)                                      |
| Binary      | `osva-connector-pipedrive` → MCP stdio server                                                  |

## `@osva-ai/connector-zoho-crm`

MCP **stdio** connector for Zoho CRM API v8: **Leads**, **Accounts**, **Contacts**, **Deals**, stage metadata, gated **stage updates** and **deal notes** (client portal sharing forced off).

| Requirement | Value                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                                     |
| npm package | `@osva-ai/connector-zoho-crm` (source-only; [INSTALL-ZOHO-CRM](./docs/INSTALL-ZOHO-CRM.md)) |
| Credentials | Region + OAuth token (`OSVA_CONNECTOR_ZOHO_CRM_*`)                                          |
| Binary      | `osva-connector-zoho-crm` → MCP stdio server                                                |

## `@osva-ai/connector-stripe`

MCP **stdio** connector for Stripe: **account**, **balance**, **balance transactions**, **PaymentIntents**, **charges**, **refunds**, **subscriptions**, **invoices**, and minimal **customer** metadata (read-only).

| Requirement | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                     |
| npm package | `@osva-ai/connector-stripe` (see [install guide](./docs/INSTALL-STRIPE.md)) |
| Credential  | `OSVA_CONNECTOR_STRIPE_API_KEY` (restricted read key)                       |
| Binary      | `osva-connector-stripe` → MCP stdio server                                  |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-stripe@0.1.0
```

Quickstart: **[docs/INSTALL-STRIPE.md](./docs/INSTALL-STRIPE.md)**. Tool reference: **[packages/stripe/README.md](./packages/stripe/README.md)**.

## `@osva-ai/connector-npm`

MCP **stdio** connector for the public npm registry: **package metadata** and **last-month download** statistics (read-only, no credentials).

| Requirement | Value                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Node.js     | **24+**                                                               |
| npm package | `@osva-ai/connector-npm` (see [install guide](./docs/INSTALL-NPM.md)) |
| Credential  | None                                                                  |
| Binary      | `osva-connector-npm` → MCP stdio server                               |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-npm@0.1.1
```

Quickstart: **[docs/INSTALL-NPM.md](./docs/INSTALL-NPM.md)**. Tool reference: **[packages/npm/README.md](./packages/npm/README.md)**.

## Packages in this repository

| Package                                                            | Description                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| [`@osva-ai/connector-github`](./packages/github)                   | GitHub MCP connector (five tools)                           |
| [`@osva-ai/connector-postgres`](./packages/postgres)               | PostgreSQL MCP connector (five read-only tools)             |
| [`@osva-ai/connector-shopify`](./packages/shopify)                 | Shopify MCP connector (seven read-only tools)               |
| [`@osva-ai/connector-ga4`](./packages/ga4)                         | Google Analytics 4 MCP connector (seven read-only tools)    |
| [`@osva-ai/connector-gsc`](./packages/gsc)                         | Google Search Console MCP connector (eight read-only tools) |
| [`@osva-ai/connector-slack`](./packages/slack)                     | Slack MCP connector (five read tools, two write tools)      |
| [`@osva-ai/connector-google-drive`](./packages/google-drive)       | Google Drive MCP connector (eight read-only tools)          |
| [`@osva-ai/connector-gmail`](./packages/gmail)                     | Gmail MCP connector (reads; drafts/sends host-gated)        |
| [`@osva-ai/connector-google-calendar`](./packages/google-calendar) | Google Calendar MCP connector (reads; mutations gated)      |
| [`@osva-ai/connector-google-sheets`](./packages/google-sheets)     | Google Sheets MCP connector (eight tools; writes gated)     |
| [`@osva-ai/connector-google-ads`](./packages/google-ads)           | Google Ads MCP connector (nine read-only tools)             |
| [`@osva-ai/connector-meta-ads`](./packages/meta-ads)               | Meta Ads MCP connector (ten read-only tools)                |
| [`@osva-ai/connector-klaviyo`](./packages/klaviyo)                 | Klaviyo MCP connector (ten read-only tools)                 |
| [`@osva-ai/connector-whatsapp`](./packages/whatsapp)               | WhatsApp Cloud API MCP connector (eight tools; send gated)  |
| [`@osva-ai/connector-hubspot`](./packages/hubspot)                 | HubSpot MCP connector (ten read-only tools)                 |
| [`@osva-ai/connector-stripe`](./packages/stripe)                   | Stripe MCP connector (ten read-only tools)                  |
| [`@osva-ai/connector-npm`](./packages/npm)                         | npm registry MCP connector (two read-only tools)            |

## `@osva-ai/connector-slack`

MCP **stdio** connector for Slack: workspace **auth test**, channel and message **read**, and controlled **message post** / **thread reply** when writes are explicitly enabled.

| Requirement | Value                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| Node.js     | **24+**                                                                   |
| npm package | `@osva-ai/connector-slack` (see [install guide](./docs/INSTALL-SLACK.md)) |
| Credential  | `OSVA_CONNECTOR_SLACK_BOT_TOKEN` (Slack bot token)                        |
| Binary      | `osva-connector-slack` → MCP stdio server                                 |

**Install (after npm publication):**

```bash
npm install @osva-ai/connector-slack@0.1.0
```

Full quickstart (Slack app scopes, channel allowlist, write guard, MCP host JSON): **[docs/INSTALL-SLACK.md](./docs/INSTALL-SLACK.md)**.

Tool reference, rate limits, output budgets, and security notes: **[packages/slack/README.md](./packages/slack/README.md)**.

## Development

Requires **pnpm 12.4.1** (see root `packageManager`).

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:boundaries
pnpm test:package-acceptance
```

`test:package-acceptance` builds a real tarball, installs it outside this repo, and smoke-tests the packaged GitHub stdio binary (C3.2).

`test:package-acceptance:postgres` packs `@osva-ai/connector-postgres`, verifies tarball boundaries, and (when `OSVA_CONNECTOR_POSTGRES_INTEGRATION_URL` is set) runs MCP acceptance through the installed binary against the PostgreSQL 16 Docker fixture (P0.5).

`test:package-acceptance:shopify` packs `@osva-ai/connector-shopify`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Shopify S2).

`test:package-acceptance:ga4` packs `@osva-ai/connector-ga4`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (GA4 G3).

`test:package-acceptance:gsc` packs `@osva-ai/connector-gsc`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (GSC).

`test:package-acceptance:slack` packs `@osva-ai/connector-slack`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Slack v0.1.0).

`test:package-acceptance:google-drive` packs `@osva-ai/connector-google-drive`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Google Drive GD1).

`test:package-acceptance:gmail` packs `@osva-ai/connector-gmail`, verifies tarball boundaries, and smoke-tests the packaged stdio binary.

`test:package-acceptance:google-calendar` packs `@osva-ai/connector-google-calendar`, verifies tarball boundaries, and smoke-tests the packaged stdio binary.

`test:package-acceptance:google-sheets` packs `@osva-ai/connector-google-sheets`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Google Sheets GS1).

`test:package-acceptance:google-ads` packs `@osva-ai/connector-google-ads`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Google Ads v0.1.0).

`test:package-acceptance:meta-ads` packs `@osva-ai/connector-meta-ads`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Meta Ads v0.1.0).

`test:package-acceptance:klaviyo` packs `@osva-ai/connector-klaviyo`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Klaviyo v0.1.0).

`test:package-acceptance:whatsapp` packs `@osva-ai/connector-whatsapp`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (WhatsApp v0.1.0).

`test:package-acceptance:hubspot` packs `@osva-ai/connector-hubspot`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (HubSpot v0.1.0).

`test:package-acceptance:stripe` packs `@osva-ai/connector-stripe`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Stripe v0.1.0).

`test:package-acceptance:npm` packs `@osva-ai/connector-npm`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (npm M17.4).

`test:package-acceptance:registry-b3` installs all seven B3 connectors at **`@0.1.0`** from the **public npm registry** (fresh cache, no `pnpm pack`) and reuses MCP smoke fixtures ([B3 publication record](./docs/B3_PUBLICATION_RECORD.md)).

## Release

**GitHub connector**

- [Release checklist](./docs/RELEASE-CHECKLIST.md)
- [Draft 0.3.1 release notes (M19.3 patch)](./docs/releases/0.3.1-RELEASE-NOTES.md) · [0.3.0 first publish](./docs/releases/0.3.0-RELEASE-NOTES.md)
- Manual npm workflow: [.github/workflows/npm-release.yml](./.github/workflows/npm-release.yml) (`workflow_dispatch` only)

**PostgreSQL connector**

- [Release checklist (PostgreSQL)](./docs/RELEASE-CHECKLIST-POSTGRES.md)
- [Draft 0.1.1 release notes (M19.3 patch)](./docs/releases/0.1.1-RELEASE-NOTES-postgres.md) · [0.1.0 first publish](./docs/releases/0.1.0-RELEASE-NOTES-postgres.md)
- Manual npm workflow: [.github/workflows/npm-release-postgres.yml](./.github/workflows/npm-release-postgres.yml) (`workflow_dispatch` only)

**Shopify connector**

- [Install guide (Shopify)](./docs/INSTALL-SHOPIFY.md)
- [Release checklist (Shopify)](./docs/RELEASE-CHECKLIST-SHOPIFY.md)
- [Draft 0.1.1 release notes (M19.3 patch)](./docs/releases/0.1.1-RELEASE-NOTES-shopify.md) · [0.1.0 first publish](./docs/releases/0.1.0-RELEASE-NOTES-shopify.md)
- Manual npm workflow: [.github/workflows/npm-release-shopify.yml](./.github/workflows/npm-release-shopify.yml) (`workflow_dispatch` only)

**GA4 connector**

- [Install guide (GA4)](./docs/INSTALL-GA4.md)
- [Release checklist (GA4)](./docs/RELEASE-CHECKLIST-GA4.md)
- [Draft 0.1.1 release notes (M19.3 patch)](./docs/releases/0.1.1-RELEASE-NOTES-ga4.md) · [0.1.0 first publish](./docs/releases/0.1.0-RELEASE-NOTES-ga4.md)
- Manual npm workflow: [.github/workflows/npm-release-ga4.yml](./.github/workflows/npm-release-ga4.yml) (`workflow_dispatch` only)

**GSC connector**

- [Install guide (GSC)](./docs/INSTALL-GSC.md)
- [Release checklist (GSC)](./docs/RELEASE-CHECKLIST-GSC.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-gsc.md)
- Manual npm workflow: [.github/workflows/npm-release-gsc.yml](./.github/workflows/npm-release-gsc.yml) (`workflow_dispatch` only)

**Slack connector**

- [Install guide (Slack)](./docs/INSTALL-SLACK.md)
- [Release checklist (Slack)](./docs/RELEASE-CHECKLIST-SLACK.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-slack.md)
- Manual npm workflow: [.github/workflows/npm-release-slack.yml](./.github/workflows/npm-release-slack.yml) (`workflow_dispatch` only)

**Google Drive connector**

- [Install guide (Google Drive)](./docs/INSTALL-GOOGLE-DRIVE.md)
- [Release checklist (Google Drive)](./docs/RELEASE-CHECKLIST-GOOGLE-DRIVE.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-google-drive.md)
- Manual npm workflow: [.github/workflows/npm-release-google-drive.yml](./.github/workflows/npm-release-google-drive.yml) (`workflow_dispatch` only)

**Google Sheets connector**

- [Install guide (Google Sheets)](./docs/INSTALL-GOOGLE-SHEETS.md)
- [Release checklist (Google Sheets)](./docs/RELEASE-CHECKLIST-GOOGLE-SHEETS.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-google-sheets.md)
- Manual npm workflow: [.github/workflows/npm-release-google-sheets.yml](./.github/workflows/npm-release-google-sheets.yml) (`workflow_dispatch` only)

**Gmail connector**

- [Install guide (Gmail)](./docs/INSTALL-GMAIL.md)
- [Release checklist (Gmail)](./docs/RELEASE-CHECKLIST-GMAIL.md)

**Google Calendar connector**

- [Install guide (Google Calendar)](./docs/INSTALL-GOOGLE-CALENDAR.md)
- [Release checklist (Google Calendar)](./docs/RELEASE-CHECKLIST-GOOGLE-CALENDAR.md)

**Google Ads connector**

- [Install guide (Google Ads)](./docs/INSTALL-GOOGLE-ADS.md)
- [Release checklist (Google Ads)](./docs/RELEASE-CHECKLIST-GOOGLE-ADS.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-google-ads.md)
- Manual npm workflow: [.github/workflows/npm-release-google-ads.yml](./.github/workflows/npm-release-google-ads.yml) (`workflow_dispatch` only)

**Meta Ads connector**

- [Install guide (Meta Ads)](./docs/INSTALL-META-ADS.md)
- [Release checklist (Meta Ads)](./docs/RELEASE-CHECKLIST-META-ADS.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-meta-ads.md)
- Manual npm workflow: [.github/workflows/npm-release-meta-ads.yml](./.github/workflows/npm-release-meta-ads.yml) (`workflow_dispatch` only)

**npm registry connector**

- [Install guide (npm)](./docs/INSTALL-NPM.md)
- [Release checklist (npm)](./docs/RELEASE-CHECKLIST-NPM.md)
- Manual npm workflow: [.github/workflows/npm-release-npm.yml](./.github/workflows/npm-release-npm.yml) (`workflow_dispatch` only)

**B3 batch (Gmail, Google Calendar, Notion, Linear, Exa, Tavily, Firecrawl)**

- [B3 publication record](./docs/B3_PUBLICATION_RECORD.md) — **22 / 24** connectors on npm; registry acceptance: `pnpm test:package-acceptance:registry-b3`
- Optional Windows preflight: [scripts/publish-b3-batch.ps1](./scripts/publish-b3-batch.ps1) (DryRun only; see record for Publish limitations)

## Security

See [SECURITY.md](./SECURITY.md). Connectors treat upstream API responses and provider exceptions as untrusted input. MCP tool discovery does **not** replace OSVA ToolPolicy or human approval for mutating tools.

## Compatibility

See [docs/compatibility.md](./docs/compatibility.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
