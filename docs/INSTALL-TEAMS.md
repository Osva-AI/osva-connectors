# Install `@osva-ai/connector-teams`

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Recommended npm version:** **`0.1.0`** (SDK **`1.1.4`** on the tarball).

## Install from npm

```bash
npm install @osva-ai/connector-teams@0.1.0
npx osva-connector-teams
```

Inject secrets via your MCP host configuration — do not commit credentials.

## Microsoft Graph (delegated only)

| Variable                            | Required | Description                                           |
| ----------------------------------- | -------- | ----------------------------------------------------- |
| `OSVA_CONNECTOR_TEAMS_ACCESS_TOKEN` | **Yes**  | Delegated user OAuth access token for Microsoft Graph |

App-only (client credentials) is **not** supported for send tools in v0.1.0. The connector does **not** use `Teamwork.Migrate.All` or other application-only migration permissions for ordinary messaging (those apply only to Microsoft’s import/migration flows).

Typical **delegated** scopes:

| Operation                             | Least-privileged delegated permission                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Joined teams / channel metadata reads | `Team.ReadBasic.All`, `Channel.ReadBasic.All` (as needed)                                                 |
| Channel message reads                 | `ChannelMessage.Read.All`                                                                                 |
| Chat reads / chat message reads       | `Chat.Read`, `ChatMessage.Read`                                                                           |
| `teams.channel.message.send`          | [`ChannelMessage.Send`](https://learn.microsoft.com/en-us/graph/permissions-reference#channelmessagesend) |
| `teams.chat.message.send`             | [`ChatMessage.Send`](https://learn.microsoft.com/en-us/graph/permissions-reference#chatmessagesend)       |

`ChannelMessage.Send` and `ChatMessage.Send` are **delegated-only** (not available as application permissions for normal sends). Graph returns **401/403** when the token lacks scope; the connector maps those to SDK `UNAUTHORIZED` / `FORBIDDEN` errors.

## Optional policy

| Variable                                            | Description                                    |
| --------------------------------------------------- | ---------------------------------------------- |
| `OSVA_CONNECTOR_TEAMS_TIMEOUT_MS`                   | HTTP timeout (default `30000`)                 |
| `OSVA_CONNECTOR_TEAMS_ALLOWED_TEAM_IDS`             | Tri-state team allowlist                       |
| `OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_IDS`          | Tri-state channel allowlist                    |
| `OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_IDS`             | Tri-state chat allowlist                       |
| `OSVA_CONNECTOR_TEAMS_SEND_ENABLED`                 | Enable send tools                              |
| `OSVA_CONNECTOR_TEAMS_HOST_SEND_APPROVED`           | Host send approval                             |
| `OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_DESTINATIONS` | `teamId:channelId` allowlist when send enabled |
| `OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_DESTINATIONS`    | Chat ID allowlist when send enabled            |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-teams": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-teams@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_TEAMS_ACCESS_TOKEN": "${GRAPH_DELEGATED_TOKEN_FROM_HOST_VAULT}"
      }
    }
  }
}
```
