# Install `@osva-ai/connector-npm`

Quickstart for running the npm registry MCP connector as a **stdio** server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.1`** (SDK **`1.1.4`** on the tarball). Registry **`0.1.0`** remains immutable with connector-sdk **`1.1.3`** on the tarball.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-npm@0.1.1
npx osva-connector-npm
```

No API keys or tokens are required for public registry metadata.

## Local tarball (before publication)

```bash
pnpm --filter @osva-ai/connector-npm build
pnpm pack --dir /tmp/npm-pack packages/npm
cd /path/to/consumer
npm install /tmp/npm-pack/osva-ai-connector-npm-0.1.1.tgz
npx osva-connector-npm
```

## Environment variables

| Variable                        | Required | Notes                                                       |
| ------------------------------- | -------- | ----------------------------------------------------------- |
| `OSVA_CONNECTOR_NPM_TIMEOUT_MS` | No       | HTTP deadline in ms (default `10000`, range `1000`–`60000`) |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-npm": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-npm@0.1.1"]
    }
  }
}
```

## Tools (read-only)

### `npm_package_metadata`

**Input:**

```json
{ "packageName": "lodash" }
```

**Example output:**

```json
{
  "name": "lodash",
  "latestVersion": "4.17.21",
  "license": "MIT",
  "repositoryUrl": "https://github.com/lodash/lodash",
  "modifiedAt": "2021-02-20T00:00:00.000Z",
  "maintainersCount": 1
}
```

Scoped packages: `{ "packageName": "@types/node" }`.

### `npm_downloads`

**Input:**

```json
{ "packageName": "lodash", "period": "last-month" }
```

**Example output:**

```json
{
  "packageName": "lodash",
  "period": "last-month",
  "downloads": 50000000,
  "start": "2026-02-01",
  "end": "2026-02-28"
}
```

Only `period: "last-month"` is supported in v1.

## Security restrictions

- Allowed hosts: `registry.npmjs.org`, `api.npmjs.org` only.
- No arbitrary URLs in tool arguments.
- Redirects are rejected (`redirect: "error"`).
- Response bodies are capped; timeouts are enforced.
- No registry write or authentication surface in this connector.

## OSVA 1.1.x compatibility

Compatible with OSVA **1.1.x** MCP hosts and ToolPolicy. Matches the canonical tool contract used by [osva-examples example 19](https://github.com/Osva-AI/osva-examples/tree/main/examples/19-research-report-agent).

### Migrating example 19 from vendored connector

1. Publish or pack `@osva-ai/connector-npm@0.1.1`.
2. Replace the vendored `src/connector/` copy with a dependency on `@osva-ai/connector-npm`.
3. Point TRUSTED_TYPESCRIPT STDIO at `node_modules/@osva-ai/connector-npm/dist/stdio.js` (or `npx osva-connector-npm`).
4. Keep the same MCP tool names (`npm_package_metadata`, `npm_downloads`) — no agent prompt changes required.

See [packages/npm/README.md](../packages/npm/README.md).
