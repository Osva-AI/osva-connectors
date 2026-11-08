# Install `@osva-ai/connector-mixpanel`

Quickstart for running the Mixpanel Query API connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:mixpanel` or `pnpm pack` until bootstrap publish.

## Mixpanel access

1. Create a [Mixpanel service account](https://docs.mixpanel.com/reference/service-accounts) with **read** access to the target project.
2. Note the service account **username** and **secret** (not the project tracking token).
3. Note the numeric **project ID** and, for Data Views projects, the **workspace ID**.
4. Choose the correct **data residency** region (`us`, `eu`, or `in`).

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-mixpanel@0.1.0
export OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_USERNAME="your-sa-username"
export OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_SECRET="your-sa-secret"
export OSVA_CONNECTOR_MIXPANEL_PROJECT_ID="12345"
export OSVA_CONNECTOR_MIXPANEL_REGION="us"
npx osva-connector-mixpanel
```

## Environment variables

| Variable                                           | Required | Notes                              |
| -------------------------------------------------- | -------- | ---------------------------------- |
| `OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_USERNAME` | Yes      | Service account username           |
| `OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_SECRET`   | Yes      | Service account secret             |
| `OSVA_CONNECTOR_MIXPANEL_PROJECT_ID`               | Yes      | Positive integer project ID        |
| `OSVA_CONNECTOR_MIXPANEL_REGION`                   | No       | `us` (default), `eu`, or `in`      |
| `OSVA_CONNECTOR_MIXPANEL_WORKSPACE_ID`             | No       | Workspace ID when using Data Views |
| `OSVA_CONNECTOR_MIXPANEL_TIMEOUT_MS`               | No       | Deadline ms (default `30000`)      |
| `OSVA_CONNECTOR_MIXPANEL_ALLOWED_BOOKMARK_IDS`     | No       | Saved Insights bookmark allowlist  |
| `OSVA_CONNECTOR_MIXPANEL_ALLOWED_FUNNEL_IDS`       | No       | Saved funnel allowlist             |

Allowlist semantics: unset = no connector-side restriction; empty string = deny all; comma-separated list = allow only those IDs.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-mixpanel": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-mixpanel@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_USERNAME": "…",
        "OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_SECRET": "…",
        "OSVA_CONNECTOR_MIXPANEL_PROJECT_ID": "12345",
        "OSVA_CONNECTOR_MIXPANEL_REGION": "us"
      }
    }
  }
}
```

## Tools (read-only)

| Tool                        | Purpose                               |
| --------------------------- | ------------------------------------- |
| `mixpanel.report.get`       | Saved Insights report (`bookmark_id`) |
| `mixpanel.segmentation.run` | Bounded event segmentation            |
| `mixpanel.funnel.get`       | Saved funnel report                   |
| `mixpanel.retention.run`    | Bounded retention analysis            |
| `mixpanel.cohort.list`      | Saved cohort metadata                 |
| `mixpanel.event.top`        | Top events (today)                    |

See [packages/mixpanel/README.md](../packages/mixpanel/README.md) and [RELEASE-CHECKLIST-MIXPANEL.md](./RELEASE-CHECKLIST-MIXPANEL.md).
