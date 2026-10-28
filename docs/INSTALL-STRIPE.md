# Install `@osva-ai/connector-stripe`

Quickstart for running the Stripe connector as an MCP stdio server.

**Requires Node.js 24+.** Depends on [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet**; use `pnpm test:package-acceptance:stripe` or `pnpm pack` until bootstrap publish.

## Stripe API key

1. In the [Stripe Dashboard](https://dashboard.stripe.com/apikeys), create a **restricted** key with read permissions for the endpoints listed in [packages/stripe/README.md](../packages/stripe/README.md).
2. Prefer a **test** key (`rk_test_…` or `sk_test_…`) for development.
3. API origin is fixed at `https://api.stripe.com` with **`Stripe-Version: 2025-09-30.clover`**.

Credentials are **never** accepted through MCP tool arguments.

## Install from npm (after publication)

```bash
npm install @osva-ai/connector-stripe@0.1.0
export OSVA_CONNECTOR_STRIPE_API_KEY="rk_test_…"
npx osva-connector-stripe
```

## Environment variables

| Variable                                  | Required | Notes                                          |
| ----------------------------------------- | -------- | ---------------------------------------------- |
| `OSVA_CONNECTOR_STRIPE_API_KEY`           | Yes      | Restricted or secret key (Bearer)              |
| `OSVA_CONNECTOR_STRIPE_TIMEOUT_MS`        | No       | Total deadline ms (default `30000`)            |
| `OSVA_CONNECTOR_STRIPE_MAX_ROWS`          | No       | Max list rows per tool (default `100`)         |
| `OSVA_CONNECTOR_STRIPE_ALLOWED_CUSTOMERS` | No       | Comma-separated `cus_` allowlist               |
| `OSVA_CONNECTOR_STRIPE_ALLOW_LIVE_MODE`   | No       | Default `false`; set `true` for live keys/data |

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

## Tool reference

See [packages/stripe/README.md](../packages/stripe/README.md).
