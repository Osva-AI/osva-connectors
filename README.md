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

## Packages in this repository

| Package                                              | Description                                     |
| ---------------------------------------------------- | ----------------------------------------------- |
| [`@osva-ai/connector-github`](./packages/github)     | GitHub MCP connector (five tools)               |
| [`@osva-ai/connector-postgres`](./packages/postgres) | PostgreSQL MCP connector (five read-only tools) |

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

## Release

**GitHub connector**

- [Release checklist](./docs/RELEASE-CHECKLIST.md)
- [Draft 0.3.0 release notes](./docs/releases/0.3.0-RELEASE-NOTES.md)
- Manual npm workflow: [.github/workflows/npm-release.yml](./.github/workflows/npm-release.yml) (`workflow_dispatch` only)

**PostgreSQL connector**

- [Release checklist (PostgreSQL)](./docs/RELEASE-CHECKLIST-POSTGRES.md)
- [Draft 0.1.0 release notes](./docs/releases/0.1.0-RELEASE-NOTES-postgres.md)
- Manual npm workflow: [.github/workflows/npm-release-postgres.yml](./.github/workflows/npm-release-postgres.yml) (`workflow_dispatch` only)

## Security

See [SECURITY.md](./SECURITY.md). Connectors treat upstream API responses and provider exceptions as untrusted input. MCP tool discovery does **not** replace OSVA ToolPolicy or human approval for mutating tools.

## Compatibility

See [docs/compatibility.md](./docs/compatibility.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
