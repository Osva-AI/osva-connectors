# Install `@osva-ai/connector-whatsapp`

Quickstart for running the WhatsApp Business Cloud API connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:whatsapp` or `pnpm pack` until bootstrap publish.

## Meta Business setup

1. Create a Meta app with **WhatsApp** product enabled and link a **WhatsApp Business Account (WABA)**.
2. Register a business phone number and note the **Phone number ID** and **WABA ID** from WhatsApp Manager or Graph API setup.
3. Generate a **system user** or **user access token** with:
   - `whatsapp_business_management` (discovery, templates, analytics)
   - `whatsapp_business_messaging` (template send only)
4. Optional: set **App Secret** on the app and configure `OSVA_CONNECTOR_WHATSAPP_APP_SECRET` for `appsecret_proof`.

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-whatsapp@0.1.0
export OSVA_CONNECTOR_WHATSAPP_ACCESS_TOKEN="your_token"
export OSVA_CONNECTOR_WHATSAPP_WABA_ID="your_waba_id"
export OSVA_CONNECTOR_WHATSAPP_PHONE_NUMBER_ID="your_phone_number_id"
npx osva-connector-whatsapp
```

## Environment variables

| Variable                                        | Required | Notes                              |
| ----------------------------------------------- | -------- | ---------------------------------- |
| `OSVA_CONNECTOR_WHATSAPP_ACCESS_TOKEN`          | Yes      | Bearer token                       |
| `OSVA_CONNECTOR_WHATSAPP_WABA_ID`               | Yes      | WABA numeric ID                    |
| `OSVA_CONNECTOR_WHATSAPP_PHONE_NUMBER_ID`       | Yes      | Sender phone number ID             |
| `OSVA_CONNECTOR_WHATSAPP_APP_SECRET`            | No       | Enables `appsecret_proof`          |
| `OSVA_CONNECTOR_WHATSAPP_ALLOWED_PHONE_NUMBERS` | No       | Comma-separated phone number IDs   |
| `OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS`    | For send | Host-verified opt-in E.164 numbers |
| `OSVA_CONNECTOR_WHATSAPP_SEND_ENABLED`          | No       | Default `false`                    |
| `OSVA_CONNECTOR_WHATSAPP_TIMEOUT_MS`            | No       | Default `30000`                    |
| `OSVA_CONNECTOR_WHATSAPP_MAX_ROWS`              | No       | Default `100`                      |

## Template send and opt-in

`whatsapp.template.send` is **disabled by default**. To enable:

1. Set `OSVA_CONNECTOR_WHATSAPP_SEND_ENABLED=true`.
2. Populate `OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS` with numbers your **host workflow** has verified for WhatsApp opt-in (utility/marketing as applicable).
3. Enforce **human approval** in the host before calling the send tool.

There is **no** MCP argument to assert consent; bypassing host policy via model-generated claims is intentionally unsupported.

## Webhooks

Delivery and inbound messages use Meta **webhooks** on your infrastructure. This stdio package does **not** expose webhook verification, inbox storage, or conversation history. Plan a separate integration for:

- `X-Hub-Signature-256` verification with your app secret
- Persistent delivery/read status
- Inbound customer messages

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-whatsapp": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-whatsapp@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_WHATSAPP_ACCESS_TOKEN": "your_token",
        "OSVA_CONNECTOR_WHATSAPP_WABA_ID": "your_waba_id",
        "OSVA_CONNECTOR_WHATSAPP_PHONE_NUMBER_ID": "your_phone_number_id"
      }
    }
  }
}
```

## Tool reference

See [packages/whatsapp/README.md](../packages/whatsapp/README.md).
