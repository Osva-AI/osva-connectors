# @osva-ai/connector-shopify

OSVA Connector Profile V1 **read-only** MCP connector for Shopify Admin GraphQL.

This package is developed in the [osva-connectors](https://github.com/Osva-AI/osva-connectors) monorepo. It is **not** published to npm from this README alone.

## Capabilities

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
| `OSVA_CONNECTOR_SHOPIFY_TIMEOUT_MS`   | No       | Per-request deadline in ms (default `30000`, min `1000`, max `120000`)                       |

Configure a custom app or dev store app in the [Shopify Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard), install it on the target store, and copy the **Admin API access token** for server-to-server use. This connector does not implement OAuth or multi-merchant onboarding.

### MCP client configuration (stdio)

After npm install (see [Package installation](#package-installation)):

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

## Required Shopify scopes (verified against Admin GraphQL)

| Tool                                          | Minimum Admin API scopes                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `shopify.shop.get`                            | Valid Admin API access token for an installed app (no catalog/order scope required for the `shop` query itself)                  |
| `shopify.product.list`, `shopify.product.get` | **`read_products`**                                                                                                              |
| `shopify.order.list`, `shopify.order.get`     | **`read_orders`** (and **`read_all_orders`** if you need more than the default ~60-day order window — requires Shopify approval) |
| `shopify.inventory.levels.list`               | **`read_inventory`** (prefer over `read_products` alone for inventory level connections)                                         |
| `shopify.location.list`                       | **`read_locations`**                                                                                                             |

### Order access limitations (Shopify-side)

- [Protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data) rules apply regardless of connector output shaping.
- Without **`read_all_orders`**, Shopify may only expose recent orders (~60 days). Missing scope or protected-data restrictions surface as sanitized `FORBIDDEN` / empty results on Shopify’s side, not as fabricated connector data.
- This connector **omits** customer names, emails, phones, addresses, and payment instruments from normalized outputs. That reduces MCP exposure but does **not** remove compliance obligations on your app.

Permission failures map to sanitized `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, or `RATE_LIMITED` errors (no tokens or raw provider stacks).

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
- **Output:** `inventoryLevels[]` (`inventoryItemId`, `locationId`, `available` when Shopify returns an `available` quantity name, `quantities[]`), `pageInfo`
- Uses Shopify `inventoryLevels` connections on `Location` or `InventoryItem` (no global unscoped traversal).

### `shopify.location.list`

- **Input:** `limit`, optional `cursor`
- **Output:** `locations[]` (`id`, `name`, `isActive`, `fulfillsOnlineOrders`), `pageInfo` (physical addresses omitted)

## Pagination and truncation

**Shopify pagination (provider):**

- Cursor-based GraphQL (`pageInfo.hasNextPage`, `pageInfo.endCursor`).
- Max **100** top-level nodes per call.
- Cursors are opaque strings ≤ 512 characters; malformed cursors are rejected at input validation.
- Each tool performs **one** Shopify GraphQL request per invocation (no recursive auto-fetch).

**Connector-side output truncation (distinct from Shopify pagination):**

- If normalizing the full provider page would exceed the structured output budget, the connector may return a prefix of list items and set `productsTruncated`, `ordersTruncated`, `locationsTruncated`, or `inventoryLevelsTruncated` to `true`.
- `pageInfo` still reflects Shopify’s connection for the fetched page; truncation flags mean the **returned array** was shortened for MCP size limits.

**Nested previews (not full Shopify pagination):**

- **Variants:** up to **10** per product (`variantsPreviewComplete`).
- **Line items:** up to **25** per order (`lineItemsPreviewComplete`).

## Output budgets and data safety

- Structured MCP JSON per tool is capped at **256 KiB** (`JSON.stringify` UTF-8 length).
- Raw HTTP bodies are capped at **2 MiB** before parsing.
- Long provider strings are truncated with explicit `*Truncated` flags where applicable.
- Resource IDs, handles, and cursors are not silently truncated.
- Missing or mistyped provider fields throw `PROVIDER_ERROR` rather than inventing defaults (except explicit nulls such as `available: null` when Shopify omits an `available` quantity).
- All Shopify content is treated as untrusted (including prompt-injection-like text in titles/descriptions).
- Read-only: GraphQL documents are fixed queries; no mutations.

## Timeouts, throttling, and retries

- **Deadline:** `OSVA_CONNECTOR_SHOPIFY_TIMEOUT_MS` applies to the entire GraphQL operation, including at most **one** read-only retry and its backoff.
- **Cancellation:** MCP abort signals propagate to in-flight HTTP requests and retry delays.
- **GraphQL Admin throttling:** Shopify reports `THROTTLED` in the JSON body (HTTP `200`). The connector parses `extensions.cost.throttleStatus` when present and maps throttle errors to `RATE_LIMITED`.
- **HTTP `429`:** Rare for GraphQL Admin but handled; may occur on some platform limits. Mapped to `RATE_LIMITED`.
- **Read-only retry (bounded):** On `THROTTLED` / HTTP `429` / HTTP 5xx, the connector performs **at most one** retry after **~1 second** (Shopify’s documented recommendation). No retry on auth, validation, oversize responses, or cancellation. No generic retry framework.

## Security boundaries

- Only **`*.myshopify.com`** hosts (or canonical store handles) are allowed; no arbitrary endpoints, ports, paths, or IP literals.
- Access tokens are never logged or returned in errors (`shpat_…` patterns are redacted).
- Errors avoid raw provider exception text and credential-bearing headers.

## Package installation

From the monorepo root (verification only; does not publish):

```bash
pnpm test:package-acceptance:shopify
```

This builds a production tarball, installs it in a temp directory **outside** the repo (no workspace symlinks), verifies npm bin metadata and Node shebang on `dist/stdio.js`, resolves `@osva-ai/connector-sdk` from the registry, and runs MCP smoke tests (`initialize`, `tools/list` for all seven tools, input schemas, missing-config exit, invalid input handling, clean stdout).

Hermetic GraphQL behavior (pagination, throttling, cancellation, PII exclusion, large responses) is covered by Vitest against a loopback fake HTTP provider — not by the packaged smoke script and **not** against production Shopify.

## Local development

```bash
pnpm install
pnpm --filter @osva-ai/connector-shopify test
pnpm --filter @osva-ai/connector-shopify build
```

## License

Apache-2.0
