# OSVA Connectors

Official MCP connector packages for the [OSVA](https://github.com/Osva-AI/osva) platform and any MCP-compatible host. Each package is a **Node.js 24+** process that speaks **MCP over stdio**, built on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk) and [Connector Profile V1](https://github.com/Osva-AI/osva/blob/main/docs/contracts/CONNECTOR_PROFILE_V1.md).

This monorepo implements **45** connectors. As of **B5.6** (2026-11-11), all **45** `@osva-ai/connector-*` packages are **published on the public npm registry** at the versions recorded in [`docs/connector-catalog.json`](./docs/connector-catalog.json). For release verification evidence, see [`docs/release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md`](./docs/release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md).

## What you get

- **Discoverable tools** via standard MCP `tools/list` and `tools/call`
- **Structured JSON** results aligned with OSVA tool contracts
- **Layered safety** — connector env gates, allowlists, and host-side ToolPolicy (authorization is never implied by tool discovery alone)
- **Reproducible installs** from npm without cloning this repository

## Verification levels (read this before production)

| Level                                    | Meaning                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Published npm package**                | Installable from the registry; version matches workspace manifests                                                 |
| **Verified MCP package startup**         | B5 published-artifact acceptance — isolated npm install, bin shim, mocked MCP smoke (no live provider credentials) |
| **Real-provider integration acceptance** | Optional live-provider matrix (`docs/operations/`) — separate operator activity; not claimed for all integrations  |

Do not assume that published npm availability equals sandbox-validated production behavior against every provider API.

## Supported runtime

| Requirement   | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Node.js       | **24+** (matches connector-sdk `engines`)                     |
| MCP transport | **stdio** (`serveStdio`); subprocess spawned by the host      |
| SDK pin       | **`@osva-ai/connector-sdk@1.1.4`** on current connector lines |

HTTP/SSE MCP endpoints are **not** exposed by these npm packages directly. Hosts that only support remote HTTP MCP need a supported bridge (not provided in this repository).

## Find connectors

- **Machine-readable catalog:** [`docs/connector-catalog.json`](./docs/connector-catalog.json) — versions, binaries, install guides, tool inventories (read-only vs mutation-capable), credential env names
- **Human index:** [`docs/compatibility.md`](./docs/compatibility.md) — SDK alignment, tool naming reference, release pointers
- **Per-connector install guides:** `docs/INSTALL*.md` (GitHub: [`docs/INSTALL.md`](./docs/INSTALL.md))
- **Package deep-dives:** `packages/<name>/README.md`

Regenerate the catalog after manifest changes:

```bash
pnpm generate:connector-catalog
```

## Quick start (external developers)

1. Pick a connector from the catalog.
2. Install the **exact published version** (example — credential-free npm registry connector):

```bash
npm install @osva-ai/connector-npm@0.1.1
npx osva-connector-npm
```

3. Wire the binary into your MCP host (stdio `command` + `args` + `env`). See [`docs/CONNECTOR_QUICKSTART.md`](./docs/CONNECTOR_QUICKSTART.md) for three complete golden paths (npm, GitHub read-only, GA4 read-only).
4. Initialize an MCP session, call `tools/list`, then invoke a **read-only** tool first.

PowerShell example (GitHub read-only at verified version):

```powershell
npm install @osva-ai/connector-github@0.4.0
$env:OSVA_CONNECTOR_GITHUB_TOKEN = "github_pat_YOUR_TOKEN_HERE"
npx osva-connector-github
```

## Authentication and credentials

- Credentials are supplied via **environment variables** (or ADC files such as `GOOGLE_APPLICATION_CREDENTIALS`), never via MCP tool arguments.
- Each install guide documents required and optional variables, minimum provider permissions, and allowlists.
- Use **fine-grained, read-only** tokens for evaluation; enable mutation env flags only when your host workflow explicitly approves writes.

## Security and mutation controls

- Many connectors ship **mutation-capable** tools behind explicit env gates (`*_WRITE_ENABLED`, host approval flags, resource allowlists).
- MCP `tools/list` does **not** grant execution authority — enforce **ToolPolicy** (and human approval where required) in the host.
- See [`SECURITY.md`](./SECURITY.md) and the connector-specific README for output bounds, retry semantics, and idempotency notes.

Treat upstream API responses as **untrusted input** in agents and UIs.

## Using connectors with OSVA

OSVA integrates external stdio connectors through the **ToolGateway** and **McpClientPool** when operators enable subprocess stdio (`OSVA_MCP_STDIO_CONNECTORS_ENABLED`). Secrets map through **SecretReference** / `SecretResolver`; writes require **ToolPolicy** before MCP invoke.

Platform setup, limitations, and pointers to osva-examples (without duplicating them here): [`docs/OSVA_INTEGRATION_GUIDE.md`](./docs/OSVA_INTEGRATION_GUIDE.md).

## Documentation and troubleshooting

| Topic                               | Document                                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Golden-path quickstarts             | [`docs/CONNECTOR_QUICKSTART.md`](./docs/CONNECTOR_QUICKSTART.md)                                                 |
| Compatibility & tool names          | [`docs/compatibility.md`](./docs/compatibility.md)                                                               |
| OSVA integration                    | [`docs/OSVA_INTEGRATION_GUIDE.md`](./docs/OSVA_INTEGRATION_GUIDE.md)                                             |
| Published release verification      | [`docs/release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md`](./docs/release/B5_6A_PUBLISHED_RELEASE_VERIFICATION.md) |
| Live-provider acceptance (optional) | [`docs/operations/B5_5A_LIVE_PROVIDER_ACCEPTANCE.md`](./docs/operations/B5_5A_LIVE_PROVIDER_ACCEPTANCE.md)       |

**Common failures**

- **Missing credential env** — connector exits at startup; check the install guide and host secret mapping.
- **Tool not authorized** — host ToolPolicy denial before MCP; expected for locked-down agents.
- **Stdio disabled on OSVA** — `StdioConnectorsDisabledError` until `OSVA_MCP_STDIO_CONNECTORS_ENABLED=true` on web/worker/mcp-server processes.
- **Version skew** — pin the catalog `publishedVersion`; older npm lines may pin legacy SDK releases.

## Development (this repository)

Requires **pnpm 12.4.1** (`packageManager` field).

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify:boundaries
pnpm generate:connector-catalog
pnpm test:onboarding
```

`pnpm test:package-acceptance` and per-connector `test:package-acceptance:*` scripts pack tarballs, install outside the monorepo, and smoke-test stdio binaries (mocked providers — no production credentials).

Release checklists live under `docs/RELEASE-CHECKLIST*.md` with manual `workflow_dispatch` npm workflows in `.github/workflows/`.

## Contributing

- Match existing package patterns (Zod schemas, bounded HTTP, credential redaction, stdio entrypoints).
- Update install guides when env contracts change.
- Run `pnpm generate:connector-catalog` and `pnpm test:onboarding` before opening a PR.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
