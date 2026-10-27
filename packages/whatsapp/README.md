# @osva-ai/connector-whatsapp

OSVA Connector Profile V1 MCP connector for the [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/) (Graph API **v26.0**).

Target first public npm version **`0.1.0`** — **not published yet**; see [docs/INSTALL-WHATSAPP.md](../../docs/INSTALL-WHATSAPP.md).

## Capabilities

Eight MCP tools:

| Tool                           | Purpose                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `whatsapp.businessAccount.get` | WABA metadata (`GET /{WABA_ID}`)                                  |
| `whatsapp.phoneNumber.list`    | Phone numbers on the WABA                                         |
| `whatsapp.phoneNumber.get`     | Single phone number metadata                                      |
| `whatsapp.businessProfile.get` | Business profile for a phone number                               |
| `whatsapp.template.list`       | Message templates (`message_templates`)                           |
| `whatsapp.template.get`        | Template by ID                                                    |
| `whatsapp.analytics.get`       | Template analytics (`template_analytics`, DAILY, CLOUD_API)       |
| `whatsapp.template.send`       | **Mutating** — one approved template to one allowlisted recipient |

## Authentication

| Setting       | Value                                                              |
| ------------- | ------------------------------------------------------------------ |
| API host      | `https://graph.facebook.com`                                       |
| Version       | `v26.0`                                                            |
| Authorization | `Bearer` system-user or user access token                          |
| Optional      | `appsecret_proof` when `OSVA_CONNECTOR_WHATSAPP_APP_SECRET` is set |

Required permissions (per tool): `whatsapp_business_management`, `whatsapp_business_messaging` (send only).

Credentials and app secrets are **never** accepted through MCP tool arguments.

## Environment variables

| Variable                                        | Required | Description                                         |
| ----------------------------------------------- | -------- | --------------------------------------------------- |
| `OSVA_CONNECTOR_WHATSAPP_ACCESS_TOKEN`          | Yes      | Meta access token                                   |
| `OSVA_CONNECTOR_WHATSAPP_WABA_ID`               | Yes      | WhatsApp Business Account ID                        |
| `OSVA_CONNECTOR_WHATSAPP_PHONE_NUMBER_ID`       | Yes      | Default sender phone number ID                      |
| `OSVA_CONNECTOR_WHATSAPP_APP_SECRET`            | No       | Enables `appsecret_proof`                           |
| `OSVA_CONNECTOR_WHATSAPP_ALLOWED_PHONE_NUMBERS` | No       | Comma-separated phone number IDs                    |
| `OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS`    | For send | Host-verified opt-in E.164 numbers (digits, no `+`) |
| `OSVA_CONNECTOR_WHATSAPP_SEND_ENABLED`          | No       | Default `false`; must be `true` to send             |
| `OSVA_CONNECTOR_WHATSAPP_TIMEOUT_MS`            | No       | Total deadline ms (default `30000`)                 |
| `OSVA_CONNECTOR_WHATSAPP_MAX_ROWS`              | No       | Max list rows (default `100`)                       |

## Customer messaging policy

- Business-initiated messages require **prior opt-in** and **approved templates** outside the customer service window.
- **`whatsapp.template.send`** is **disabled by default**. The host must set `OSVA_CONNECTOR_WHATSAPP_SEND_ENABLED=true` **and** list only opt-in recipients in `OSVA_CONNECTOR_WHATSAPP_ALLOWED_RECIPIENTS`. There is **no** tool argument to bypass this policy.
- **Authentication / OTP templates are blocked** in v0.1.0.
- **One recipient per call**; no free-form text, bulk arrays, header media URLs, or arbitrary template component passthrough.
- Sends return a WhatsApp message ID only — **not delivery**. Use **signed webhooks** (configured outside this stdio package) for delivery and read receipts.
- Do **not** retry ambiguous send failures automatically (timeouts / 5xx may still have been accepted).

## Webhooks (out of scope for v0.1.0)

Inbound messages and delivery statuses are delivered to your infrastructure via Meta webhooks. This connector does **not** expose conversation history, start a public HTTP listener, or verify webhook signatures. See README limitations and [docs/INSTALL-WHATSAPP.md](../../docs/INSTALL-WHATSAPP.md).

## Analytics

`whatsapp.analytics.get` maps to `GET /{WABA_ID}/template_analytics` with `granularity=DAILY` and `product_type=CLOUD_API`. Template analytics must be **confirmed** on the WABA (WhatsApp Manager or API). Per Meta docs, read/click metrics use a **7-day** window; EU/JP restrictions may apply.

## Output budget

Structured MCP output is capped at **256 KiB** UTF-8 on `JSON.stringify(result)`. Provider strings are truncated and marked untrusted where applicable.

## MCP stdio

Binary: `osva-connector-whatsapp` → `dist/stdio.js`.

```bash
pnpm --filter @osva-ai/connector-whatsapp test
pnpm --filter @osva-ai/connector-whatsapp build
```
