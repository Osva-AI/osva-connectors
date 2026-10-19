# OSVA compatibility

This repository implements standalone connectors against public OSVA contracts.

## SDK and contracts

| Component                       | Version (C0.1)                                                           |
| ------------------------------- | ------------------------------------------------------------------------ |
| `@osva-ai/connector-sdk`        | `1.1.0-rc.2`                                                             |
| Transitive `@osva-ai/contracts` | `1.1.0-rc.2` (via connector-sdk)                                         |
| MCP packages (via SDK)          | `@modelcontextprotocol/node@2.0.0`, `@modelcontextprotocol/server@2.0.0` |

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

Tool names use dot-separated segments and remain stable for a connector version.

## Output budgets (C3.1)

`@osva-ai/connector-github` enforces runtime output budgets on all five tools (**256 KiB UTF-8 on `JSON.stringify(structuredContent)`** per call—not the full duplicated MCP `CallToolResult`), per-field string caps, and `issuesTruncated` / `*Truncated` metadata. Additive optional fields may appear on tool results; input JSON schemas are unchanged. See [packages/github/README.md](../packages/github/README.md#output-bounds-c31).

## Node.js

Node.js 24+ is required (aligned with `@osva-ai/connector-sdk` engines).

## Release status

| Package                       | npm version (target)           | Published                                                                                      |
| ----------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `@osva-ai/connector-github`   | `0.3.0` (first public release) | Not yet — install via tarball/`pnpm pack` for acceptance testing until `npm publish`           |
| `@osva-ai/connector-postgres` | `0.1.0` (first public release) | Not yet — install via tarball/`pnpm pack` for acceptance testing until bootstrap `npm publish` |
| `@osva-ai/connector-shopify`  | `0.1.0` (first public release) | Not yet — install via tarball/`pnpm pack` for acceptance testing until bootstrap `npm publish` |
| `@osva-ai/connector-ga4`      | `0.1.0` (first public release) | Not yet — install via tarball/`pnpm pack` for acceptance testing until bootstrap `npm publish` |

See [INSTALL.md](./INSTALL.md), [INSTALL-POSTGRES.md](./INSTALL-POSTGRES.md), [INSTALL-SHOPIFY.md](./INSTALL-SHOPIFY.md), [INSTALL-GA4.md](./INSTALL-GA4.md), [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md), [RELEASE-CHECKLIST-POSTGRES.md](./RELEASE-CHECKLIST-POSTGRES.md), [RELEASE-CHECKLIST-SHOPIFY.md](./RELEASE-CHECKLIST-SHOPIFY.md), and [RELEASE-CHECKLIST-GA4.md](./RELEASE-CHECKLIST-GA4.md).
