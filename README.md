# osva-connectors

Official OSVA connector packages built on the public [`@osva-ai/connector-sdk`](https://www.npmjs.com/package/@osva-ai/connector-sdk) and [Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md).

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
npm install @osva-ai/connector-github@0.3.0
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
npm install @osva-ai/connector-postgres@<version>
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
npm install @osva-ai/connector-ga4@0.1.0
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

## Packages in this repository

| Package                                                        | Description                                                 |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| [`@osva-ai/connector-github`](./packages/github)               | GitHub MCP connector (five tools)                           |
| [`@osva-ai/connector-postgres`](./packages/postgres)           | PostgreSQL MCP connector (five read-only tools)             |
| [`@osva-ai/connector-shopify`](./packages/shopify)             | Shopify MCP connector (seven read-only tools)               |
| [`@osva-ai/connector-ga4`](./packages/ga4)                     | Google Analytics 4 MCP connector (seven read-only tools)    |
| [`@osva-ai/connector-gsc`](./packages/gsc)                     | Google Search Console MCP connector (eight read-only tools) |
| [`@osva-ai/connector-slack`](./packages/slack)                 | Slack MCP connector (five read tools, two write tools)      |
| [`@osva-ai/connector-google-drive`](./packages/google-drive)   | Google Drive MCP connector (eight read-only tools)          |
| [`@osva-ai/connector-google-sheets`](./packages/google-sheets) | Google Sheets MCP connector (eight tools; writes gated)     |

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

`test:package-acceptance:google-sheets` packs `@osva-ai/connector-google-sheets`, verifies tarball boundaries, and smoke-tests the packaged stdio binary (Google Sheets GS1).

## Release

**GitHub connector**

- [Release checklist](./docs/RELEASE-CHECKLIST.md)
- [Draft 0.3.0 release notes](./docs/releases/0.3.0-RELEASE-NOTES.md)
- Manual npm workflow: [.github/workflows/npm-release.yml](./.github/workflows/npm-release.yml) (`workflow_dispatch` only)

**PostgreSQL connector**

- [Release checklist (PostgreSQL)](./docs/RELEASE-CHECKLIST-POSTGRES.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-postgres.md)
- Manual npm workflow: [.github/workflows/npm-release-postgres.yml](./.github/workflows/npm-release-postgres.yml) (`workflow_dispatch` only)

**Shopify connector**

- [Install guide (Shopify)](./docs/INSTALL-SHOPIFY.md)
- [Release checklist (Shopify)](./docs/RELEASE-CHECKLIST-SHOPIFY.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-shopify.md)
- Manual npm workflow: [.github/workflows/npm-release-shopify.yml](./.github/workflows/npm-release-shopify.yml) (`workflow_dispatch` only)

**GA4 connector**

- [Install guide (GA4)](./docs/INSTALL-GA4.md)
- [Release checklist (GA4)](./docs/RELEASE-CHECKLIST-GA4.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-ga4.md)
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

## Security

See [SECURITY.md](./SECURITY.md). Connectors treat upstream API responses and provider exceptions as untrusted input. MCP tool discovery does **not** replace OSVA ToolPolicy or human approval for mutating tools.

## Compatibility

See [docs/compatibility.md](./docs/compatibility.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
