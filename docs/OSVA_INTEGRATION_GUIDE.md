# OSVA integration guide (stdio connectors)

This document explains how **published OSVA connector npm packages** relate to the **Osva-AI/osva** platform. It does not duplicate [osva-examples](https://github.com/Osva-AI/osva-examples); use that repository for full sample agents and workflows.

## Transport model

| Layer                            | Behavior                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **osva-connectors npm packages** | MCP **stdio** only — the host spawns `npx osva-connector-<id>` (or an absolute binary path) and exchanges JSON-RPC over stdin/stdout |
| **Generic MCP desktop hosts**    | Same stdio subprocess model (`mcpServers` configuration)                                                                             |
| **OSVA production runtime**      | Invokes stdio connectors through **ToolGateway** → **McpClientPool** when operator gates allow subprocess MCP                        |

These packages do **not** expose standalone HTTP MCP servers. Registering a connector as a remote HTTP URL without a supported bridge is **not** a documented integration path in this repository.

## OSVA platform contract (read-only summary)

Authoritative references in **Osva-AI/osva**:

| Topic                          | Document                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Connector profile              | [CONNECTOR_PROFILE_V1.md](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md)                             |
| Tool execution & policy        | [TOOL_CONTRACT.md](https://github.com/Osva-AI/osva/blob/main/docs/contracts/TOOL_CONTRACT.md)                                           |
| Cross-repo acceptance harness  | [CONNECTOR_TOOL_GATEWAY_ACCEPTANCE.md](https://github.com/Osva-AI/osva/blob/main/docs/engineering/CONNECTOR_TOOL_GATEWAY_ACCEPTANCE.md) |
| Stdio operator flags           | [CONFIGURATION.md](https://github.com/Osva-AI/osva/blob/main/docs/deployment/CONFIGURATION.md)                                          |
| Ecosystem compatibility matrix | [EXTERNAL_ECOSYSTEM_COMPATIBILITY.md](https://github.com/Osva-AI/osva/blob/main/docs/architecture/EXTERNAL_ECOSYSTEM_COMPATIBILITY.md)  |

### Configuration storage and credentials

- Connector **transport configuration** in OSVA references how to spawn the stdio process (command, args, non-secret env).
- **Secrets** (tokens, database URLs) are **not** embedded in transport config. They are supplied through **SecretReference** keys resolved by **SecretResolver** into the subprocess environment at invoke time (see ToolGateway acceptance doc §SecretReference wiring).
- MCP `tools/list` exposes schemas only — **ToolPolicy** must authorize each logical tool binding before execution.

### Discovery, import, and binding

Typical OSVA flow (simplified):

1. Operator enables stdio connectors (`OSVA_MCP_STDIO_CONNECTORS_ENABLED=true` on web, worker, and mcp-server processes — default is **false**).
2. Connector registry entry points at the stdio entry (published package version or pinned checkout fixture).
3. MCP discovery imports tool versions and creates **immutable MCP binding metadata** for an agent version.
4. ToolGateway checks **ToolPolicy** (workspace-scoped) then invokes MCP with resolved secrets.

Failure modes exercised in cross-repo tests include `TOOL_NOT_AUTHORIZED`, `SecretNotFoundError`, and `StdioConnectorsDisabledError`.

### Execution and errors

- Provider failures surface as sanitized MCP tool errors (`MCP_TOOL_ERROR`) without leaking secrets.
- Cancellation propagates via `AbortSignal` where the connector SDK supports it.
- Outbound network policy defaults remain strict (`allowPrivateNetworks: false` unless explicitly configured for operators).

## What works today without osva code changes

- Install any published connector from npm and attach it to a **stdio-capable MCP host** (see [CONNECTOR_QUICKSTART.md](./CONNECTOR_QUICKSTART.md)).
- Run OSVA **ToolGateway integration tests** against connector test stdio fixtures when `OSVA_CONNECTORS_ROOT` and connector-specific `OSVA_*_CONNECTOR_TEST_STDIO_ENTRY` variables are set (documented in osva engineering guide).
- Reuse **osva-examples** for end-to-end patterns (npm connector, GitHub, workflows) without copying them into this repo.

## Known limitations (defer platform work to B6.3+ in osva)

| Gap                         | Notes                                                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP MCP registry only      | If a deployment only registers remote HTTP MCP servers, stdio npm packages require a **bridge** not shipped here — document host-specific adapters or enable OSVA stdio subprocess path |
| Stdio disabled by default   | Production OSVA requires explicit operator opt-in; document in runbooks                                                                                                                 |
| Console UX variance         | Connector registry UI capabilities evolve in osva; verify against the osva release you deploy                                                                                           |
| Postgres cross-repo fixture | osva documents deferred Postgres ToolGateway fixture until published in osva-connectors                                                                                                 |

No Console features or REST endpoints are invented in this guide. When integration needs new first-party APIs, implement them in **Osva-AI/osva** and link back to connector install docs.

## Minimal OSVA-aligned checklist

1. Pin connector **npm version** from [connector-catalog.json](./connector-catalog.json).
2. Map each secret env var to a **SecretReference** (never plain text in persisted config).
3. Enable **stdio** only on processes that should spawn connectors.
4. Import tools into the agent version; bind logical names.
5. Configure **ToolPolicy** — deny mutation tools until workflows require them.
6. Run packaged acceptance (`pnpm test:package-acceptance:<id>`) or published-artifact scripts before promoting versions.

## Related osva-connectors docs

- [CONNECTOR_QUICKSTART.md](./CONNECTOR_QUICKSTART.md)
- [compatibility.md](./compatibility.md)
- [B5_6A published verification](./release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md)
