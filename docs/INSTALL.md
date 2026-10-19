# Install `@osva-ai/connector-github`

Quickstart for external developers running the GitHub connector as an MCP stdio server.

**Requires Node.js 24+.** The connector depends on the published [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

## Install from npm (after first publication)

These commands assume `@osva-ai/connector-github@0.3.0` (or later) is published to the npm registry.

### POSIX (bash/zsh)

```bash
npm install @osva-ai/connector-github@0.3.0
export OSVA_CONNECTOR_GITHUB_TOKEN="github_pat_YOUR_TOKEN_HERE"
npx osva-connector-github
```

### Windows (PowerShell)

```powershell
npm install @osva-ai/connector-github@0.3.0
$env:OSVA_CONNECTOR_GITHUB_TOKEN = "github_pat_YOUR_TOKEN_HERE"
npx osva-connector-github
```

Do not commit tokens or store them in tracked `.env` files. Inject credentials via your MCP host’s secret configuration.

## GitHub fine-grained personal access token

1. GitHub → **Settings** → **Developer settings** → **Fine-grained tokens** → **Generate new token**.
2. Limit **Repository access** to the repositories agents should use.
3. Grant the minimum permissions below for your tools.

| Tools you need                                                               | Repository permissions                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| Read-only (`github.repository.get`, `github.issue.list`, `github.issue.get`) | **Metadata** (read), **Issues** (read)           |
| Mutating (`github.issue.create`, `github.issue.comment.create`)              | **Metadata** (read), **Issues** (read and write) |

Read-only workflows should use a token **without** Issues write.

## MCP host configuration (stdio)

Example MCP client configuration (shape varies by host). **Requires a published npm package** (or a local path you manage yourself):

```json
{
  "mcpServers": {
    "osva-github": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-github@0.3.0"],
      "env": {
        "OSVA_CONNECTOR_GITHUB_TOKEN": "github_pat_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"` instead of `npx`.

**Authorization:** MCP `tools/list` exposes tool names and schemas only. It does **not** grant GitHub access, OSVA ToolPolicy approval, or human sign-off. Restrict mutating tools in your platform configuration.

## Discoverable tools (Connector Profile V1)

| Tool                          | Mutating |
| ----------------------------- | -------- |
| `github.repository.get`       | No       |
| `github.issue.list`           | No       |
| `github.issue.get`            | No       |
| `github.issue.create`         | **Yes**  |
| `github.issue.comment.create` | **Yes**  |

## Example MCP `tools/call` payloads

Read-only (single GitHub REST request per invocation for list/get):

```json
{
  "name": "github.issue.list",
  "arguments": {
    "owner": "Osva-AI",
    "repo": "osva-connectors",
    "state": "open",
    "page": 1,
    "perPage": 20
  }
}
```

Mutating (**writes GitHub state**; one create POST per invocation, no connector-level retries; ambiguous failures require verification on GitHub):

```json
{
  "name": "github.issue.create",
  "arguments": {
    "owner": "Osva-AI",
    "repo": "osva-connectors",
    "title": "Investigate flaky check",
    "body": "Opened via MCP (example)."
  }
}
```

## Develop from source (this repository)

For contributors, not end-user installation:

```bash
git clone https://github.com/Osva-AI/osva-connectors.git
cd osva-connectors
pnpm install --frozen-lockfile
pnpm build
export OSVA_CONNECTOR_GITHUB_TOKEN="github_pat_YOUR_TOKEN_HERE"
node packages/github/dist/stdio.js
```

See the root [README](../README.md) for verification commands, including `pnpm test:package-acceptance`.

## Further reading

- [Package README](../packages/github/README.md) — tool contracts, errors, output budgets, mutation semantics
- [Compatibility](./compatibility.md)
- [SECURITY.md](../SECURITY.md)
