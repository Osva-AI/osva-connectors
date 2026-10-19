# @osva-ai/connector-shopify

OSVA Connector Profile V1 **read-only** MCP connector for Shopify Admin GraphQL.

This package is developed in the [osva-connectors](https://github.com/Osva-AI/osva-connectors) monorepo. It is **not** published to npm by default from this README alone.

## Capabilities (S1)

Seven MCP tools:

| Tool                            | Purpose                                      |
| ------------------------------- | -------------------------------------------- |
| `shopify.shop.get`              | Shop metadata                                |
| `shopify.product.list`          | Product list with search + cursor pagination |
| `shopify.product.get`           | Single product summary                       |
| `shopify.order.list`            | Non-PII order list                           |
| `shopify.order.get`             | Non-PII order detail                         |
| `shopify.inventory.levels.list` | Inventory levels (scoped)                    |
| `shopify.location.list`         | Fulfillment locations (no addresses)         |

Supported Admin API version default: **`2026-10`** (override with `OSVA_CONNECTOR_SHOPIFY_API_VERSION`).

## Setup

### Environment variables

| Variable                              | Required | Description                                                                                  |
| ------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `OSVA_CONNECTOR_SHOPIFY_SHOP`         | Yes      | Store handle (`my-store`) or `my-store.myshopify.com` (HTTPS URL without path also accepted) |
| `OSVA_CONNECTOR_SHOPIFY_ACCESS_TOKEN` | Yes      | Admin API access token from your Shopify app                                                 |
| `OSVA_CONNECTOR_SHOPIFY_API_VERSION`  | No       | `YYYY-MM` version (default `2026-10`)                                                        |
| `OSVA_CONNECTOR_SHOPIFY_TIMEOUT_MS`   | No       | Per-request timeout in ms (default `30000`, min `1000`, max `120000`)                        |

The connector does **not** implement OAuth or multi-merchant onboarding in S1. Configure a custom app or dev store app in the [Shopify Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard), install it on the target store, and copy the **Admin API access token** for server-to-server use. Legacy private/custom app flows may not be available for all merchants; follow current Shopify documentation for your app type.

### MCP client configuration (stdio)

```json
{
  "mcpServers": {
    "osva-shopify": {
      "command": "npx",
      "args": ["-y", "@osva-ai/connector-shopify"],
      "env": {
        "OSVA_CONNECTOR_SHOPIFY_SHOP": "your-store",
        "OSVA_CONNECTOR_SHOPIFY_ACCESS_TOKEN": "shpat_…"
      }
    }
  }
}
```

Local monorepo development:

```json
{
  "command": "node",
  "args": ["packages/shopify/dist/stdio.js"]
}
```

## Required Shopify scopes (least privilege)

| Tool                                          | Minimum Admin API scopes                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `shopify.shop.get`                            | Valid Admin API access token for an installed app (no catalog/order scope required for the `shop` query itself)                  |
| `shopify.product.list`, `shopify.product.get` | **`read_products`**                                                                                                              |
| `shopify.order.list`, `shopify.order.get`     | **`read_orders`** (and **`read_all_orders`** if you need more than the default ~60-day order window — requires Shopify approval) |
| `shopify.inventory.levels.list`               | **`read_inventory`** (or **`read_products`** for some inventory reads — prefer **`read_inventory`**)                             |
| `shopify.location.list`                       | **`read_locations`**                                                                                                             |

Orders are subject to [protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data) rules and historical access limits. This connector **omits** customer names, emails, phones, addresses, and payment details from normalized outputs, but that does **not** remove your app's compliance obligations on Shopify.

Permission failures surface as sanitized `UNAUTHORIZED`, `FORBIDDEN`, or `RATE_LIMITED` errors.

## Tool contracts

### `shopify.shop.get`

- **Input:** `{}`
- **Output:** `id`, `name`, `myshopifyDomain`, `currencyCode`, `ianaTimezone`

### `shopify.product.list`

- **Input:** `limit` (default 25, max 100), optional `cursor`, optional `query` (max 256 chars)
- **Output:** `products[]`, `pageInfo` (`hasNextPage`, `endCursor` when applicable)
- Each product includes a **bounded variant preview** (`variants`, `variantsPreviewComplete`).

### `shopify.product.get`

- **Input:** `id` (`gid://shopify/Product/…`)
- **Output:** Product summary, `description`, `tags`, bounded `variants`, `variantsPreviewComplete`
- No unrestricted metafields.

### `shopify.order.list`

- **Input:** `limit`, optional `cursor`, optional `query`
- **Output:** `orders[]`, `pageInfo`
- Order fields: `id`, `name`, timestamps, `displayFinancialStatus`, `displayFulfillmentStatus`, `totalPrice`, `currencyCode`

### `shopify.order.get`

- **Input:** `id` (`gid://shopify/Order/…`)
- **Output:** Order summary, `subtotalPrice`, `totalTax`, bounded `lineItems`, `lineItemsPreviewComplete`

### `shopify.inventory.levels.list`

- **Input:** optional `locationId`, optional `inventoryItemId` (**at least one required**), `limit`, optional `cursor`
- **Output:** `inventoryLevels[]` (`inventoryItemId`, `locationId`, `available`, `quantities[]`), `pageInfo`
- Uses Shopify `inventoryLevels` connections on `Location` or `InventoryItem` (no invented global connection).

### `shopify.location.list`

- **Input:** `limit`, optional `cursor`
- **Output:** `locations[]` (`id`, `name`, `isActive`, `fulfillsOnlineOrders`), `pageInfo` (addresses omitted)

## Pagination

- Cursor-based GraphQL pagination (`pageInfo.hasNextPage`, `pageInfo.endCursor`).
- Max **100** top-level nodes per call.
- Cursors must be opaque strings ≤ 512 characters; malformed cursors are rejected at input validation.
- Each tool performs **one** Shopify GraphQL request per invocation (no recursive auto-fetch).

## Nested previews

- **Variants:** up to **10** per product (`variantsPreviewComplete` indicates whether more variants exist).
- **Line items:** up to **25** per order (`lineItemsPreviewComplete`).

## Output budgets

- Structured MCP JSON per tool is capped at **256 KiB** (`JSON.stringify` length).
- Long provider strings are truncated with explicit `*Truncated` flags where applicable.
- Resource IDs, handles, and cursors are not silently truncated.
- Full raw GraphQL responses are never returned to MCP clients.

## Timeouts and rate limits

- Finite HTTP timeouts (configurable); cancellation propagates via MCP abort signals.
- HTTP `429` and GraphQL throttle metadata map to `RATE_LIMITED`.
- **No automatic retry framework** in S1.

## Security model

- Only **`*.myshopify.com`** hosts (or canonical store handles) are allowed; no arbitrary endpoints, ports, paths, or IP literals.
- Access tokens are never logged or returned in errors.
- All Shopify content is treated as untrusted data (including prompt-injection-like text in titles/descriptions).
- Read-only: GraphQL documents are fixed queries; no mutations.

## Local testing

```bash
pnpm install
pnpm --filter @osva-ai/connector-shopify test
pnpm --filter @osva-ai/connector-shopify build
```

Tests use loopback HTTP fixtures; **no production Shopify credentials** are required in CI.

## Future stages (not in S1)

- OAuth install flows and multi-store routing
- Writes (products, inventory adjustments, fulfillments)
- Webhooks and incremental sync
- Automatic retries with throttle-aware backoff

## License

Apache-2.0
