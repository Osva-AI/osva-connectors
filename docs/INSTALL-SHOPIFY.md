# Install `@osva-ai/connector-shopify`

Quickstart for external developers running the Shopify connector as an MCP stdio server against a store you control.

**Requires Node.js 24+.** The connector depends on the published [`@osva-ai/connector-sdk@1.1.0-rc.2`](https://www.npmjs.com/package/@osva-ai/connector-sdk).

**Target first public version:** `0.1.0`. The package is **not published yet** as of S3 preparation; use monorepo `pnpm test:package-acceptance:shopify` or `pnpm pack` until bootstrap publish completes.

## Install from npm (after first publication)

### POSIX (bash/zsh)

```bash
npm install @osva-ai/connector-shopify@0.1.0
export OSVA_CONNECTOR_SHOPIFY_SHOP="your-store"
export OSVA_CONNECTOR_SHOPIFY_ACCESS_TOKEN="shpat_YOUR_TOKEN_HERE"
npx osva-connector-shopify
```

### Windows (PowerShell)

```powershell
npm install @osva-ai/connector-shopify@0.1.0
$env:OSVA_CONNECTOR_SHOPIFY_SHOP = "your-store"
$env:OSVA_CONNECTOR_SHOPIFY_ACCESS_TOKEN = "shpat_YOUR_TOKEN_HERE"
npx osva-connector-shopify
```

Do not commit Admin API tokens or store them in tracked `.env` files. Inject credentials via your MCP host’s secret configuration.

## Admin API access token

1. Create or open a **custom app** (or dev store app) in the [Shopify Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard).
2. Install the app on the target store.
3. Copy the **Admin API access token** (`shpat_…`) for server-to-server use.
4. Grant only the scopes you need (see below).

This connector does **not** implement OAuth install flows or multi-store routing.

## Required environment variables

| Variable                              | Required | Notes                                                                  |
| ------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `OSVA_CONNECTOR_SHOPIFY_SHOP`         | Yes      | Store handle (`my-store`) or `my-store.myshopify.com`                  |
| `OSVA_CONNECTOR_SHOPIFY_ACCESS_TOKEN` | Yes      | Admin API access token                                                 |
| `OSVA_CONNECTOR_SHOPIFY_API_VERSION`  | No       | `YYYY-MM` Admin API version (default **`2026-10`**)                    |
| `OSVA_CONNECTOR_SHOPIFY_TIMEOUT_MS`   | No       | Whole GraphQL operation deadline in ms (default `30000`, max `120000`) |

Only **`*.myshopify.com`** hosts derived from the shop identifier are contacted; arbitrary URLs are rejected.

## Required Admin API scopes (least privilege)

| Tools                                         | Scopes                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `shopify.shop.get`                            | Valid installed-app token (no catalog/order scope required for `shop` query)                                                |
| `shopify.product.list`, `shopify.product.get` | **`read_products`**                                                                                                         |
| `shopify.order.list`, `shopify.order.get`     | **`read_orders`** (+ **`read_all_orders`** if you need beyond Shopify’s default ~60-day window — requires Shopify approval) |
| `shopify.inventory.levels.list`               | **`read_inventory`** (preferred)                                                                                            |
| `shopify.location.list`                       | **`read_locations`**                                                                                                        |

## MCP host configuration (stdio)

```json
{
  "mcpServers": {
    "osva-shopify": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-shopify@0.1.0"],
      "env": {
        "OSVA_CONNECTOR_SHOPIFY_SHOP": "your-store",
        "OSVA_CONNECTOR_SHOPIFY_ACCESS_TOKEN": "shpat_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

On Windows, some hosts accept `"command": "npx.cmd"`.

**Authorization:** MCP `tools/list` exposes tool names and schemas only. It does **not** grant Shopify access, OSVA ToolPolicy approval, or compliance with [protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data) rules.

## Discoverable tools (all read-only)

| Tool                            | Purpose                                       |
| ------------------------------- | --------------------------------------------- |
| `shopify.shop.get`              | Shop metadata                                 |
| `shopify.product.list`          | Product list with search + cursor pagination  |
| `shopify.product.get`           | Single product summary                        |
| `shopify.order.list`            | Non-PII order list                            |
| `shopify.order.get`             | Non-PII order detail                          |
| `shopify.inventory.levels.list` | Inventory levels (scoped by location or item) |
| `shopify.location.list`         | Fulfillment locations (no addresses)          |

**No write tools** (no product/order/inventory mutations).

## Order data and protected customer data

- Normalized outputs **omit** customer names, emails, phones, addresses, and payment instruments.
- That shaping **does not** remove your app’s obligations under Shopify protected customer data policies or order-history access rules.
- Without **`read_all_orders`**, Shopify may only expose recent orders. Empty lists or `FORBIDDEN` errors can reflect Shopify-side limits, not connector bugs.

## Output budgets, pagination, and throttling

- **Structured MCP JSON:** 256 KiB max per tool response; list tools may set `*Truncated` when the connector shortens arrays for size limits (distinct from Shopify `pageInfo` pagination).
- **One GraphQL request** per tool invocation; use `pageInfo.endCursor` for next pages.
- **Throttling:** Shopify GraphQL Admin usually returns HTTP `200` with `THROTTLED` in the body; the connector maps these to `RATE_LIMITED`.
- **Retry:** At most **one** read-only retry after ~1 second for throttle / HTTP `429` / HTTP 5xx, within the configured timeout. No automatic retry on auth or validation errors.

Details: [packages/shopify/README.md](../packages/shopify/README.md).

## Post-publication verification (operator)

In a **fresh temporary directory** (not the monorepo):

```bash
npm install @osva-ai/connector-shopify@0.1.0 @modelcontextprotocol/client@2.0.0
npm view @osva-ai/connector-shopify@0.1.0 version
npm view @osva-ai/connector-shopify bin
```

Configure real shop/token in your MCP host, then confirm:

- `tools/list` returns exactly **seven** `shopify.*` tools with object `inputSchema` on each.
- Missing shop/token causes non-zero process exit with **clean stdout** (stderr may describe configuration).
- Invalid tool arguments return MCP errors **without** leaking `shpat_` tokens.

Monorepo equivalent before publish: `pnpm test:package-acceptance:shopify`.

## Further reading

- [Release checklist (Shopify)](./RELEASE-CHECKLIST-SHOPIFY.md)
- [Draft 0.1.0 release notes](./releases/0.1.0-RELEASE-NOTES-shopify.md)
