# osva-connectors

Official OSVA connector packages built on the public [`@osva-ai/connector-sdk`](https://www.npmjs.com/package/@osva-ai/connector-sdk) and [Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md).

## Packages

| Package                                          | Description                                            |
| ------------------------------------------------ | ------------------------------------------------------ |
| [`@osva-ai/connector-github`](./packages/github) | GitHub connector (repository/issue read, issue create) |

## Requirements

- Node.js 24+
- pnpm 12.4.1 (see root `packageManager`)

## Development

```bash
pnpm install
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:boundaries
pnpm test:package-acceptance
```

`test:package-acceptance` builds a real tarball, installs it in a temporary project outside this repo, and runs MCP smoke tests against the packaged stdio binary (C3.2).

## Security

See [SECURITY.md](./SECURITY.md). Connectors treat upstream API responses and provider exceptions as untrusted input.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
