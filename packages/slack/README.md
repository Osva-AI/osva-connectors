# @osva-ai/connector-slack

OSVA Connector Profile V1 MCP connector for Slack: channel and message **read**, plus controlled **message post** and **thread reply** when explicitly enabled via environment configuration.

Target first public npm version **`0.1.0`**. See [docs/INSTALL-SLACK.md](../../docs/INSTALL-SLACK.md).

## Capabilities

Seven MCP tools:

| Tool                    | Mutating | Purpose                                          |
| ----------------------- | -------- | ------------------------------------------------ |
| `slack.auth.test`       | No       | Verify bot token; return workspace/bot identity  |
| `slack.channel.list`    | No       | List public/private channels (cursor pagination) |
| `slack.channel.info`    | No       | Channel metadata                                 |
| `slack.message.history` | No       | Bounded channel message history                  |
| `slack.message.thread`  | No       | Bounded thread replies                           |
| `slack.message.post`    | **Yes**  | Post plain-text channel message                  |
| `slack.message.reply`   | **Yes**  | Post plain-text thread reply                     |

## Authentication

| Variable                                | Required | Description                                                             |
| --------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `OSVA_CONNECTOR_SLACK_BOT_TOKEN`        | Yes      | Slack bot token (`xoxb-…`); sent only in `Authorization: Bearer` header |
| `OSVA_CONNECTOR_SLACK_TIMEOUT_MS`       | No       | Operation deadline ms (default `30000`, min `1000`, max `120000`)       |
| `OSVA_CONNECTOR_SLACK_ALLOWED_CHANNELS` | No       | Comma-separated channel IDs (`C…` / `G…`); enforced on reads and writes |
| `OSVA_CONNECTOR_SLACK_WRITE_ENABLED`    | No       | Must be `true` to allow `slack.message.post` / `slack.message.reply`    |

Recommended bot scopes for v0.1.0:

- `channels:read`, `channels:history`
- `groups:read`, `groups:history` (private channels)
- `chat:write`

Direct messages are **not** supported in v0.1.0.

## Write safeguards

- Writes are **disabled by default**.
- Posting is an **external side effect**; MCP `tools/list` is not approval. Host OSVA workflows must enforce human or policy approval before mutating tools.
- Ambiguous post failures (timeout, 5xx, rate limit on POST) use a verify-in-Slack message with `retryable: false`.
- Read-only calls may retry **at most once** for eligible transient errors within the deadline.

## Output budgets

- Structured MCP JSON: **256 KiB** max per tool result (`JSON.stringify`).
- HTTP response read cap: **2 MiB**.
- Message text truncated in outputs; connector-side list truncation exposes `*Truncated` flags.

## Security

Slack message text, topics, and purposes are **untrusted external content**. The connector does not execute instructions embedded in messages. Residual prompt-injection risk remains for autonomous agents that misinterpret message text as commands.

## MCP stdio

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

Local monorepo: `"command": "node"`, `"args": ["packages/slack/dist/stdio.js"]`.
