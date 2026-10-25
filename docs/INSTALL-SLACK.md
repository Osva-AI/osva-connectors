# Install `@osva-ai/connector-slack`

Quickstart for running the Slack connector as an MCP stdio server against a workspace you control.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0` (not published until bootstrap release).

## Create a Slack app and bot token

1. Open [Slack API → Your Apps](https://api.slack.com/apps) and **Create New App** → **From scratch**.
2. Under **OAuth & Permissions → Bot Token Scopes**, add:
   - `channels:read`, `channels:history`
   - `groups:read`, `groups:history` (if you need private channels)
   - `chat:write` (only if you will enable posting)
3. **Install to Workspace** and copy the **Bot User OAuth Token** (`xoxb-…`).
4. **Invite the bot** to each channel it should read or post in (`/invite @YourBot`).

Bot tokens are **never** accepted through MCP tool arguments. Configure them only via environment variables or your MCP host secret store.

## Environment variables

| Variable                                | Required | Notes                                                                |
| --------------------------------------- | -------- | -------------------------------------------------------------------- |
| `OSVA_CONNECTOR_SLACK_BOT_TOKEN`        | Yes      | Bot token (`xoxb-…`); sent as `Authorization: Bearer` only           |
| `OSVA_CONNECTOR_SLACK_TIMEOUT_MS`       | No       | Total deadline ms (default `30000`, min `1000`, max `120000`)        |
| `OSVA_CONNECTOR_SLACK_ALLOWED_CHANNELS` | No       | Comma-separated `C…` / `G…` IDs; enforced on reads and writes        |
| `OSVA_CONNECTOR_SLACK_WRITE_ENABLED`    | No       | Must be `true` to allow `slack.message.post` / `slack.message.reply` |

Writes are **disabled by default**. Posting is an external side effect; your OSVA host must enforce approval before mutating tools.

## Install from npm (after first publication)

### POSIX

```bash
npm install @osva-ai/connector-slack@0.1.0
export OSVA_CONNECTOR_SLACK_BOT_TOKEN="xoxb-…"
npx osva-connector-slack
```

### Windows (PowerShell)

```powershell
npm install @osva-ai/connector-slack@0.1.0
$env:OSVA_CONNECTOR_SLACK_BOT_TOKEN = "xoxb-…"
npx osva-connector-slack
```

## MCP host configuration (stdio)

```json
{
  "mcpServers": {
    "osva-slack": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-slack@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_SLACK_BOT_TOKEN": "xoxb-…"
      }
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

## Discoverable tools

| Tool                    | Access    | Purpose                           |
| ----------------------- | --------- | --------------------------------- |
| `slack.auth.test`       | Read      | Verify token / workspace identity |
| `slack.channel.list`    | Read      | List channels (cursor pagination) |
| `slack.channel.info`    | Read      | Channel metadata                  |
| `slack.message.history` | Read      | Channel messages (bounded page)   |
| `slack.message.thread`  | Read      | Thread replies (bounded page)     |
| `slack.message.post`    | **Write** | Post plain-text message           |
| `slack.message.reply`   | **Write** | Post plain-text thread reply      |

## Pagination

Read tools return at most one Slack API page per call. Use `nextCursor` from the tool result for additional pages. Allowlist filtering on `slack.channel.list` is applied locally and does not imply all matching channels were retrieved in one call.

## Security notes

- Treat all Slack message text as untrusted content.
- Residual prompt-injection risk remains for autonomous agents.
- The connector calls only `https://slack.com/api/` (no arbitrary URL configuration in production).

## Post-publication verification (operator)

After bootstrap publish:

```bash
npm view @osva-ai/connector-slack@0.1.0 version
npm view @osva-ai/connector-slack bin
```

In a clean directory, install the package, configure a bot token, run `npx osva-connector-slack`, and confirm **seven** tools via MCP `tools/list`.
