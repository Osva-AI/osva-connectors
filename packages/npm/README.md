# `@osva-ai/connector-npm`

Read-only MCP **stdio** connector for the public npm registry and npm downloads API.

| Requirement | Value                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------ |
| Node.js     | **24+**                                                                                    |
| npm package | `@osva-ai/connector-npm@0.1.0` (not published yet — use `pnpm pack` or package acceptance) |
| Credentials | None                                                                                       |
| Binary      | `osva-connector-npm`                                                                       |

Installation and MCP host configuration: **[docs/INSTALL-NPM.md](../../docs/INSTALL-NPM.md)**.

## Tools

| Tool                   | Description                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `npm_package_metadata` | Normalized metadata for a package (`latestVersion`, license, repository URL, deprecation, etc.) |
| `npm_downloads`        | Last-calendar-month download count via `api.npmjs.org` (`period`: `last-month` only)            |

Tool names and JSON schemas match the canonical connector in [Osva-AI/osva](https://github.com/Osva-AI/osva) (`examples/canonical-dependency-adoption/mcp/npm-connector`).

## Security

- Outbound HTTPS is limited to `https://registry.npmjs.org` and `https://api.npmjs.org`.
- No user-supplied URLs; package names are validated before requests.
- `fetch` uses `redirect: "error"`.
- Responses are bounded (default 2 MiB) with request timeouts (default 10s).
- Read-only: no publish, tag, or registry mutation operations.

## Environment

| Variable                        | Default | Purpose                          |
| ------------------------------- | ------- | -------------------------------- |
| `OSVA_CONNECTOR_NPM_TIMEOUT_MS` | `10000` | Total HTTP deadline (1000–60000) |

## Programmatic use

```typescript
import { createNpmConnector, createNpmClient } from "@osva-ai/connector-npm";
```
