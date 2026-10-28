# `@osva-ai/connector-stripe`

OSVA Connector Profile V1 **read-only** Stripe MCP connector (stdio). Uses fixed `https://api.stripe.com` with a pinned **`Stripe-Version`** header (`2025-09-30.clover`).

## Credentials

| Variable                                  | Required | Description                                                                                                                                          |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_STRIPE_API_KEY`           | Yes      | Restricted **secret** or **restricted** key (`sk_test_` / `sk_live_` / `rk_test_` / `rk_live_`). Bearer auth. Never pass keys in MCP tool arguments. |
| `OSVA_CONNECTOR_STRIPE_TIMEOUT_MS`        | No       | Total request deadline (default `30000`, max `120000`).                                                                                              |
| `OSVA_CONNECTOR_STRIPE_MAX_ROWS`          | No       | Max rows per list tool (default `100`, max `1000`). Each Stripe page is capped at `100`.                                                             |
| `OSVA_CONNECTOR_STRIPE_ALLOWED_CUSTOMERS` | No       | Comma-separated `cus_` IDs enforced on customer-scoped filters and `stripe.customer.get`. Not a full account authorization boundary.                 |
| `OSVA_CONNECTOR_STRIPE_ALLOW_LIVE_MODE`   | No       | Default `false`. When false, **live** keys (`*_live_*`) are rejected at startup and live-mode resources are blocked.                                 |

### Test vs live

- **Test keys** (`*_test_*`) operate on Stripe test data. Recommended for local development.
- **Live keys** (`*_live_*`) access production financial data. Require explicit `OSVA_CONNECTOR_STRIPE_ALLOW_LIVE_MODE=true`.
- The connector does **not** auto-switch environments; the key determines the Stripe account/mode.

### Restricted key permissions (read)

Provision a restricted key with **read** access only for:

| Tool                                 | Stripe endpoint                | Suggested permission               |
| ------------------------------------ | ------------------------------ | ---------------------------------- |
| `stripe.account.get`                 | `GET /v1/account`              | Account (read)                     |
| `stripe.balance.get`                 | `GET /v1/balance`              | Balance (read)                     |
| `stripe.balanceTransaction.list`     | `GET /v1/balance_transactions` | Balance transaction sources (read) |
| `stripe.paymentIntent.list` / `.get` | `GET /v1/payment_intents`      | PaymentIntents (read)              |
| `stripe.charge.list`                 | `GET /v1/charges`              | Charges (read)                     |
| `stripe.refund.list`                 | `GET /v1/refunds`              | Refunds (read)                     |
| `stripe.subscription.list`           | `GET /v1/subscriptions`        | Subscriptions (read)               |
| `stripe.invoice.list`                | `GET /v1/invoices`             | Invoices (read)                    |
| `stripe.customer.get`                | `GET /v1/customers/:id`        | Customers (read)                   |

No Connect multi-account headers, refunds creation, payouts, or write APIs in v0.1.0.

## Financial semantics

- Amounts are **integer minor units** as returned by Stripe (e.g. cents for USD). Original integers are preserved; no FX conversion.
- Currencies are lowercase ISO codes. Zero-decimal currencies (e.g. `jpy`) and three-decimal currencies (e.g. `bhd`) follow [Stripe currency rules](https://docs.stripe.com/currencies); the connector does not infer decimal places.
- **PaymentIntent** `amount` vs `amountReceived`, **Charge** captured/refunded fields, and **balance transaction** `amount` / `fee` / `net` are reported separately. Do not double-count PaymentIntents and Charges as revenue; settlement timing follows balance transactions.
- Missing numeric fields are omitted or returned as `null` — zeros are not fabricated.

## Tools

| Tool                             | Description                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `stripe.account.get`             | Account id, country, default currency, high-level status flags (no bank/identity fields).                                  |
| `stripe.balance.get`             | Available and pending balances per currency (not combined across currencies).                                              |
| `stripe.balanceTransaction.list` | Settlement ledger rows with fee/net; filters: `createdGte`, `createdLte`, `type`, pagination.                              |
| `stripe.paymentIntent.list`      | Bounded list; filters: created range, optional `customerId`.                                                               |
| `stripe.paymentIntent.get`       | Single PaymentIntent metadata (no `client_secret`, payment methods, or addresses).                                         |
| `stripe.charge.list`             | Charges linked to PaymentIntents; no card/payment-method payloads.                                                         |
| `stripe.refund.list`             | Refund amounts/status/reason; optional charge or PaymentIntent filter.                                                     |
| `stripe.subscription.list`       | Status, billing interval, period boundaries (subscription + item shapes for Clover API).                                   |
| `stripe.invoice.list`            | Subtotal, total, amount paid/due, status; Clover invoice fields.                                                           |
| `stripe.customer.get`            | `id`, `created`, `delinquent`, `currency`, `balance`, `livemode` only (no email, phone, name, address, tax IDs, metadata). |

List tools accept `limit` (≤100 per Stripe request, further capped by `MAX_ROWS`) and `startingAfter` (Stripe object id cursor). Provider `url` fields are validated but never fetched.

## Security and privacy

- Fixed GET endpoint inventory; no generic Stripe passthrough.
- Provider strings are treated as untrusted content (truncated/normalized); never agent instructions.
- Configure OSVA host **ToolPolicy** and workspace access so only approved agents can invoke financial tools.

## Output bounds

Structured MCP JSON output is capped at **256 KiB** UTF-8 per tool call. HTTP responses are capped at **2 MiB** before parsing.

## MCP host (stdio)

```json
{
  "mcpServers": {
    "osva-stripe": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-stripe@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_STRIPE_API_KEY": "rk_test_…"
      }
    }
  }
}
```

## Known limitations (v0.1.0)

- Read-only; no refunds, captures, payouts, or subscription mutations.
- No full customer directory export (`customer.list` not exposed).
- No revenue aggregation tool; reporting is row-level only.
- Customer allowlist is optional and does not replace Stripe account authorization.

## Future work

Guarded write tools (e.g. test-mode payment links) may be added behind explicit host policy in a later release.
