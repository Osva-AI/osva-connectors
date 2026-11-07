# @osva-ai/connector-teams

OSVA Connector Profile V1 **Microsoft Teams** MCP connector (stdio): bounded **delegated** Microsoft Graph reads and **controlled channel/chat sends** when explicitly enabled by the host.

## Capabilities

| Tool                         | Graph API                                              |
| ---------------------------- | ------------------------------------------------------ |
| `teams.team.list`            | `GET /me/joinedTeams`                                  |
| `teams.channel.list`         | `GET /teams/{team-id}/channels`                        |
| `teams.channel.message.list` | `GET /teams/{team-id}/channels/{channel-id}/messages`  |
| `teams.channel.reply.list`   | `GET .../messages/{message-id}/replies`                |
| `teams.chat.list`            | `GET /me/chats`                                        |
| `teams.chat.message.list`    | `GET /me/chats/{chat-id}/messages`                     |
| `teams.channel.message.send` | `POST /teams/{team-id}/channels/{channel-id}/messages` |
| `teams.chat.message.send`    | `POST /chats/{chat-id}/messages`                       |

Read tools are available with a delegated user token. Send tools require additional host configuration (below).

## Authentication (delegated only in v1)

**`OSVA_CONNECTOR_TEAMS_ACCESS_TOKEN` is required.** The host must inject a short-lived **delegated user** OAuth access token for the signed-in user. This connector does **not** implement OAuth flows, refresh tokens, or **application (app-only)** permissions for sending. App-only / client-credentials sending is **not supported** in Profile V1.

## Host policy: reads

Tri-state allowlists (comma-separated). **Unset** = no allowlist (all permitted). **Empty/whitespace** = explicit deny-all. **Nonempty** = only listed IDs.

| Variable                                   | Applies to                |
| ------------------------------------------ | ------------------------- |
| `OSVA_CONNECTOR_TEAMS_ALLOWED_TEAM_IDS`    | Teams returned / accepted |
| `OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_IDS` | Channels                  |
| `OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_IDS`    | Chats                     |

## Host policy: sends (disabled by default)

| Gate                                                       | Environment variable                                |
| ---------------------------------------------------------- | --------------------------------------------------- |
| Allow sends                                                | `OSVA_CONNECTOR_TEAMS_SEND_ENABLED=true`            |
| Host workflow approval                                     | `OSVA_CONNECTOR_TEAMS_HOST_SEND_APPROVED=true`      |
| Channel destinations (`teamId:channelId`, comma-separated) | `OSVA_CONNECTOR_TEAMS_ALLOWED_CHANNEL_DESTINATIONS` |
| Chat destinations (chat IDs, comma-separated)              | `OSVA_CONNECTOR_TEAMS_ALLOWED_CHAT_DESTINATIONS`    |

When send is enabled, **both** destination allowlists must be non-empty. Channel IDs in destinations may contain colons; the team GUID is parsed before the first `:`.

Sends are **non-idempotent**; the HTTP client performs **no automatic retries** on `POST` endpoints. There is **no bulk or broadcast** tool — one message per call.

## Other configuration

| Variable                          | Default |
| --------------------------------- | ------- |
| `OSVA_CONNECTOR_TEAMS_TIMEOUT_MS` | `30000` |

## Output and trust

- Structured MCP output is capped (`OUTPUT_MAX_STRUCTURED_JSON_BYTES` in `src/constants.ts`).
- Message **HTML and plain text** are **untrusted** external content (`untrustedContent` on list outputs).
- OData `@odata.nextLink` values are validated before reuse; pass them back as tool `nextLink`.

## MCP stdio

```bash
npx osva-connector-teams
```

Programmatic use:

```ts
import {
  createTeamsConnector,
  createGraphRestClient,
  loadTeamsConfig,
} from "@osva-ai/connector-teams";
```

## Microsoft Graph

| API                  | Host                               |
| -------------------- | ---------------------------------- |
| Microsoft Graph v1.0 | `https://graph.microsoft.com/v1.0` |

Required delegated scopes depend on your host policy (typical examples include `Team.ReadBasic.All`, `Channel.ReadBasic.All`, `ChannelMessage.Read.All`, `Chat.Read`, `ChatMessage.Send`, `ChannelMessage.Send` — choose the minimum set for your deployment).
