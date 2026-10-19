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

## Packages in this repository

| Package                                          | Description                       |
| ------------------------------------------------ | --------------------------------- |
| [`@osva-ai/connector-github`](./packages/github) | GitHub MCP connector (five tools) |

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

`test:package-acceptance` builds a real tarball, installs it outside this repo, and smoke-tests the packaged stdio binary (C3.2).

## Release

- [Release checklist](./docs/RELEASE-CHECKLIST.md)
- [Draft 0.3.0 release notes](./docs/releases/0.3.0-RELEASE-NOTES.md)
- Manual npm workflow: [.github/workflows/npm-release.yml](./.github/workflows/npm-release.yml) (`workflow_dispatch` only)

## Security

See [SECURITY.md](./SECURITY.md). Connectors treat upstream API responses and provider exceptions as untrusted input. MCP tool discovery does **not** replace OSVA ToolPolicy or human approval for mutating tools.

## Compatibility

See [docs/compatibility.md](./docs/compatibility.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
