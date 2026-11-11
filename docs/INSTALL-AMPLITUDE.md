# Install `@osva-ai/connector-amplitude`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Amplitude access

1. In Amplitude, open **Settings → Projects** and copy the project **API key** and **secret key** (Dashboard REST credentials).
2. Confirm data residency: default (US) or **EU** (`analytics.eu.amplitude.com`).
3. Optional: configure a comma-separated saved **chart ID** allowlist for defense in depth.

Credentials are **never** accepted through MCP tool arguments. Per-user search/activity endpoints are not exposed.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-amplitude@0.1.0
export OSVA_CONNECTOR_AMPLITUDE_API_KEY="your-api-key"
export OSVA_CONNECTOR_AMPLITUDE_SECRET_KEY="your-secret-key"
export OSVA_CONNECTOR_AMPLITUDE_REGION="us"
npx osva-connector-amplitude
```

## Environment variables

| Variable                                     | Required | Notes                                          |
| -------------------------------------------- | -------- | ---------------------------------------------- |
| `OSVA_CONNECTOR_AMPLITUDE_API_KEY`           | Yes      | Project API key (Basic auth username)          |
| `OSVA_CONNECTOR_AMPLITUDE_SECRET_KEY`        | Yes      | Project secret key (Basic auth password)       |
| `OSVA_CONNECTOR_AMPLITUDE_REGION`            | No       | `us` (default) or `eu`                         |
| `OSVA_CONNECTOR_AMPLITUDE_TIMEOUT_MS`        | No       | Deadline ms (default `30000`)                  |
| `OSVA_CONNECTOR_AMPLITUDE_ALLOWED_CHART_IDS` | No       | Saved chart allowlist (`unset` / empty / list) |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-amplitude": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-amplitude@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_AMPLITUDE_API_KEY": "…",
        "OSVA_CONNECTOR_AMPLITUDE_SECRET_KEY": "…",
        "OSVA_CONNECTOR_AMPLITUDE_REGION": "us"
      }
    }
  }
}
```

## Tools (read-only)

| Tool                           | Purpose                    |
| ------------------------------ | -------------------------- |
| `amplitude.event.list`         | Event type discovery       |
| `amplitude.event.segmentation` | Event segmentation series  |
| `amplitude.funnel.run`         | Funnel analysis            |
| `amplitude.retention.run`      | Retention analysis         |
| `amplitude.user.active`        | Active/new user aggregates |
| `amplitude.chart.get`          | Saved chart query          |
| `amplitude.session.average`    | Average session length     |

See [packages/amplitude/README.md](../packages/amplitude/README.md) and [RELEASE-CHECKLIST-AMPLITUDE.md](./RELEASE-CHECKLIST-AMPLITUDE.md).
