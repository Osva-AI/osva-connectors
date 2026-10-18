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

C1.1 registers these tools:

- `github.repository.get`
- `github.issue.list`
- `github.issue.get`

Tool names use dot-separated segments and remain stable for a connector version.

## Node.js

Node.js 24+ is required (aligned with `@osva-ai/connector-sdk` engines).
