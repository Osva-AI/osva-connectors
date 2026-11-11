# Connector quickstart (golden paths)

Three copy-pasteable paths for external developers evaluating OSVA connectors outside this monorepo. Each path uses an **exact published npm version**, MCP **stdio**, and a **read-only** tool invocation. No GitHub writes are performed in these examples.

Prerequisites for all paths:

- **Node.js 24+**
- An MCP host that can spawn a subprocess (`command`, `args`, `env`) — Cursor, Claude Desktop, or OSVA with stdio enabled (see [OSVA_INTEGRATION_GUIDE.md](./OSVA_INTEGRATION_GUIDE.md))

---

## Golden Path A — Lowest friction (`@osva-ai/connector-npm`)

The npm registry connector queries **public** `registry.npmjs.org` and `api.npmjs.org`. It does **not** require API keys. Outbound network access is still required.

### Install and run

**POSIX:**

```bash
npm install @osva-ai/connector-npm@0.1.1
npx osva-connector-npm
```

**Windows (PowerShell):**

```powershell
npm install @osva-ai/connector-npm@0.1.1
npx osva-connector-npm
```

### MCP host (stdio)

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

### Session flow

1. Initialize MCP session (host-specific).
2. `tools/list` — expect `npm_package_metadata` and `npm_downloads`.
3. **Read-only call** — `npm_package_metadata`:

```json
{
  "name": "npm_package_metadata",
  "arguments": {
    "packageName": "@osva-ai/connector-sdk"
  }
}
```

4. Inspect structured JSON (`latestVersion`, license, repository URL).
5. Shut down the host or stop the subprocess cleanly.

Deeper reference: [INSTALL-NPM.md](./INSTALL-NPM.md), [packages/npm/README.md](../packages/npm/README.md).

---

## Golden Path B — GitHub read-only (`@osva-ai/connector-github@0.4.0`)

Requires a **fine-grained GitHub PAT** with repository allowlist and **read-only** issue permissions. This quickstart does **not** use `github.issue.create` or `github.issue.comment.create`.

### Token setup

1. GitHub → **Settings** → **Developer settings** → **Fine-grained tokens** → **Generate new token**.
2. **Repository access:** Only repositories you want agents to read.
3. **Permissions:** **Metadata** (read), **Issues** (read) — **no** Issues write.

Optional defense in depth: set `OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES` to `owner/repo` allowlist (comma-separated).

### Install and run

**POSIX:**

```bash
npm install @osva-ai/connector-github@0.4.0
export OSVA_CONNECTOR_GITHUB_TOKEN="github_pat_YOUR_TOKEN_HERE"
export OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES="Osva-AI/osva-connectors"
npx osva-connector-github
```

**Windows (PowerShell):**

```powershell
npm install @osva-ai/connector-github@0.4.0
$env:OSVA_CONNECTOR_GITHUB_TOKEN = "github_pat_YOUR_TOKEN_HERE"
$env:OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES = "Osva-AI/osva-connectors"
npx osva-connector-github
```

### MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-github": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-github@0.4.0"],
      "env": {
        "OSVA_CONNECTOR_GITHUB_TOKEN": "github_pat_YOUR_TOKEN_HERE",
        "OSVA_CONNECTOR_GITHUB_ALLOWED_REPOSITORIES": "Osva-AI/osva-connectors"
      }
    }
  }
}
```

On Windows, some hosts require `"command": "npx.cmd"`.

### Session flow

1. `tools/list` — five tools; only read tools are used here.
2. **Read-only call** — `github.repository.get`:

```json
{
  "name": "github.repository.get",
  "arguments": {
    "owner": "Osva-AI",
    "repo": "osva-connectors"
  }
}
```

3. Expect repository metadata (default branch, visibility, description). Output is bounded per [packages/github/README.md](../packages/github/README.md).

### Common failures

| Symptom                      | Likely cause                                                   |
| ---------------------------- | -------------------------------------------------------------- |
| 401 / bad credentials        | Expired or wrong token; variable not passed to subprocess      |
| 403 on repository            | Token not granted access to `owner/repo` or allowlist mismatch |
| Empty tools / immediate exit | Missing `OSVA_CONNECTOR_GITHUB_TOKEN`                          |

Full install guide: [INSTALL.md](./INSTALL.md).

---

## Golden Path C — GA4 read-only (`@osva-ai/connector-ga4@0.1.1`)

Requires **Google Cloud** credentials with **Analytics read-only** scope on a GA4 property you control.

### Google Cloud setup (summary)

1. Enable **Google Analytics Data API** and **Google Analytics Admin API** on a GCP project.
2. Use a **service account** JSON file or workstation ADC (`gcloud auth application-default login`).
3. Grant the principal **Viewer** on the target GA4 property (Admin → Property access management).

### Install and run

**POSIX:**

```bash
npm install @osva-ai/connector-ga4@0.1.1
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
export OSVA_CONNECTOR_GA4_PROPERTY_ID="YOUR_NUMERIC_PROPERTY_ID"
npx osva-connector-ga4
```

**Windows (PowerShell):**

```powershell
npm install @osva-ai/connector-ga4@0.1.1
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
$env:OSVA_CONNECTOR_GA4_PROPERTY_ID = "YOUR_NUMERIC_PROPERTY_ID"
npx osva-connector-ga4
```

### MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-ga4": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-ga4@0.1.1"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "OSVA_CONNECTOR_GA4_PROPERTY_ID": "YOUR_NUMERIC_PROPERTY_ID"
      }
    }
  }
}
```

### Session flow

1. `tools/list` — seven read-only GA4 tools.
2. **Read-only call** — `ga4.property.list` (no arguments) or `ga4.property.get` with your property ID.
3. Inspect property metadata before running heavier `ga4.report.*` tools.
4. Respect Google Analytics **quota** and connector output bounds; paginate when the tool returns truncation hints.

### Rate limits

GA4 Data API quotas apply per property. Start with small date ranges in `ga4.report.run` after `ga4.metadata.get` succeeds.

Full install guide: [INSTALL-GA4.md](./INSTALL-GA4.md), [packages/ga4/README.md](../packages/ga4/README.md).

---

## Next steps

- Browse all connectors: [connector-catalog.json](./connector-catalog.json)
- Wire connectors into OSVA: [OSVA_INTEGRATION_GUIDE.md](./OSVA_INTEGRATION_GUIDE.md)
- Example agents and durable workflows (separate repo): [Osva-AI/osva-examples](https://github.com/Osva-AI/osva-examples)
