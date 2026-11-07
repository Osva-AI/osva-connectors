# Install `@osva-ai/connector-gmail`

Quickstart for running the Gmail connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.4`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Published:** `@osva-ai/connector-gmail@0.1.0` on npm ([B3 publication record](./B3_PUBLICATION_RECORD.md)). For monorepo tarball checks before a patch release, use `pnpm test:package-acceptance:gmail` or `pnpm test:package-acceptance:registry-b3`.

## Google Cloud

1. Create or select a [Google Cloud project](https://console.cloud.google.com/).
2. Enable **Gmail API**.
3. Configure credentials **outside** this connector (host responsibility):
   - **User OAuth:** obtain refresh/access tokens via your host’s OAuth client; pass a short-lived **access token** via `OSVA_CONNECTOR_GMAIL_ACCESS_TOKEN`, **or**
   - **ADC / service account** for automation; see environment variables below.

Default OAuth scopes (computed from flags unless overridden):

| Mode                | Scopes                                               |
| ------------------- | ---------------------------------------------------- |
| Read-only (default) | `https://www.googleapis.com/auth/gmail.readonly`     |
| Drafts enabled      | Adds `https://www.googleapis.com/auth/gmail.compose` |
| Send enabled        | Adds `https://www.googleapis.com/auth/gmail.send`    |

Override completely with `OSVA_CONNECTOR_GMAIL_SCOPES` (space- or comma-separated).

Restricted scopes may require Google verification for public OAuth clients.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-gmail@0.1.0
npx osva-connector-gmail
```

## Environment variables

| Variable                                     | Required                  | Description                                                                             |
| -------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_GMAIL_ACCESS_TOKEN`          | One of token **or** ADC   | Static OAuth access token from the host (not persisted by the connector)                |
| `GOOGLE_APPLICATION_CREDENTIALS`             | For service account / ADC | Path to JSON key when not using access token                                            |
| `OSVA_CONNECTOR_GMAIL_TIMEOUT_MS`            | No                        | Total request deadline ms (default `30000`)                                             |
| `OSVA_CONNECTOR_GMAIL_SCOPES`                | No                        | Override default scope list                                                             |
| `OSVA_CONNECTOR_GMAIL_USE_DOMAIN_DELEGATION` | No                        | `true` to impersonate `OSVA_CONNECTOR_GMAIL_DELEGATED_USER_EMAIL` (JWT + admin consent) |
| `OSVA_CONNECTOR_GMAIL_DELEGATED_USER_EMAIL`  | With delegation           | Workspace user to act as                                                                |
| `OSVA_CONNECTOR_GMAIL_DRAFTS_ENABLED`        | For drafts                | `true` to expose draft create/update                                                    |
| `OSVA_CONNECTOR_GMAIL_SEND_ENABLED`          | For send                  | `true` to allow `gmail.message.send`                                                    |
| `OSVA_CONNECTOR_GMAIL_HOST_SEND_APPROVED`    | For send                  | `true` after host workflow sign-off                                                     |
| `OSVA_CONNECTOR_GMAIL_ALLOWED_RECIPIENTS`    | For drafts/sends          | Comma-separated lowercase emails allowlist                                              |

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-gmail": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-gmail@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_GMAIL_ACCESS_TOKEN": "${GMAIL_ACCESS_TOKEN_FROM_HOST_VAULT}"
      }
    }
  }
}
```

## Package acceptance

From the repository root:

```bash
pnpm test:package-acceptance:gmail
```
