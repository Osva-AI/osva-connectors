# Implementation report — B4.5 Commerce platforms (`feat/b4-commerce-platforms`)

## Summary

Two new publishable packages under OSVA Connector Profile V1:

- [`@osva-ai/connector-woocommerce`](../packages/woocommerce) — **10** MCP tools (WooCommerce REST **wc/v3**).
- [`@osva-ai/connector-bigcommerce`](../packages/bigcommerce) — **10** MCP tools (BigCommerce Admin **Catalog v3** + **Orders v2**).

Repository connector count: **31 → 33**. Prior **22** npm publications unchanged (these packages are **source-only** until release). Both pin **`@osva-ai/connector-sdk@1.1.4`**, target **Node 24+** / **pnpm 12.4.1**, use **strict TypeScript** in all `src/` modules, and follow Jira/Qdrant/Mixpanel patterns (bounded REST, Zod + JSON Schema, credential redaction, stdio binaries, mock HTTP fixtures, package acceptance, manual OIDC release workflows).

**Not committed, not published, not pushed** (per task).

## Phase 1 — Build vs reuse

| Provider        | Official / community alternative                                 | Decision                | Rationale                                                                                                                                 |
| --------------- | ---------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **WooCommerce** | WordPress REST + third-party MCP wrappers (variable quality)     | Thin **wc/v3** adapter  | Pin store origin; path allowlist; Basic auth redaction; numeric ID allowlists; gated writes; order PII off by default; no arbitrary URLs. |
| **BigCommerce** | [BigCommerce MCP](https://developer.bigcommerce.com/) (evolving) | Thin Admin REST adapter | Fixed `api.bigcommerce.com` host; store hash prefix; token header only; same OSVA gate model as WooCommerce.                              |

We do **not** embed WordPress/PHP runtimes or reimplement catalog engines. Tool surfaces are intentionally smaller than full admin UIs.

### Change-impact inventory

| Area              | Impact                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Packages (new)    | `packages/woocommerce/**`, `packages/bigcommerce/**`                                                                        |
| Workspace scripts | `scripts/connector-packages.mjs`, `package-acceptance-{woocommerce,bigcommerce}*.mjs`, `package-acceptance-npm-dry-run.mjs` |
| CI release        | `.github/workflows/npm-release-{woocommerce,bigcommerce}.yml`                                                               |
| Docs              | `INSTALL-*`, `RELEASE-CHECKLIST-*`, `compatibility.md`, `README.md`, this report                                            |
| Prior connectors  | No functional changes to existing packages (workspace wiring + lockfile importers only)                                     |

## Tool surfaces

| Package     | Tools                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WooCommerce | `woocommerce.product.list/get`, `woocommerce.variation.list/get`, `woocommerce.category.list`, `woocommerce.order.list/get`, `woocommerce.order.note.list`, `woocommerce.product.update`, `woocommerce.order.status.update`                                |
| BigCommerce | `bigcommerce.product.list/get`, `bigcommerce.variant.list`, `bigcommerce.category.tree.list`, `bigcommerce.category.list`, `bigcommerce.order.list/get`, `bigcommerce.order.product.list`, `bigcommerce.product.update`, `bigcommerce.order.status.update` |

## Selected API endpoints

### WooCommerce REST (`/wp-json/wc/v3`)

| MCP tool                          | HTTP (relative to configured store base) |
| --------------------------------- | ---------------------------------------- |
| `woocommerce.product.list`        | `GET /products`                          |
| `woocommerce.product.get`         | `GET /products/{id}`                     |
| `woocommerce.product.update`      | `PUT /products/{id}`                     |
| `woocommerce.variation.list`      | `GET /products/{id}/variations`          |
| `woocommerce.variation.get`       | `GET /products/{id}/variations/{vid}`    |
| `woocommerce.category.list`       | `GET /products/categories`               |
| `woocommerce.order.list`          | `GET /orders`                            |
| `woocommerce.order.get`           | `GET /orders/{id}`                       |
| `woocommerce.order.note.list`     | `GET /orders/{id}/notes`                 |
| `woocommerce.order.status.update` | `PUT /orders/{id}` (status field only)   |

Store URL is parsed once: **HTTPS** required (loopback HTTP only with explicit test flag), no userinfo/query/fragment, origin pinned for every request.

### BigCommerce Admin REST

| MCP tool                          | HTTP (under `/stores/{store_hash}`)      |
| --------------------------------- | ---------------------------------------- |
| `bigcommerce.product.list`        | `GET /v3/catalog/products`               |
| `bigcommerce.product.get`         | `GET /v3/catalog/products/{id}`          |
| `bigcommerce.product.update`      | `PUT /v3/catalog/products/{id}`          |
| `bigcommerce.variant.list`        | `GET /v3/catalog/products/{id}/variants` |
| `bigcommerce.category.tree.list`  | `GET /v3/catalog/trees`                  |
| `bigcommerce.category.list`       | `GET /v3/catalog/trees/{id}/categories`  |
| `bigcommerce.order.list`          | `GET /v2/orders`                         |
| `bigcommerce.order.get`           | `GET /v2/orders/{id}`                    |
| `bigcommerce.order.product.list`  | `GET /v2/orders/{id}/products`           |
| `bigcommerce.order.status.update` | `PUT /v2/orders/{id}` (status only)      |

Default API host: **`https://api.bigcommerce.com`**. Override allowed only with `OSVA_CONNECTOR_BIGCOMMERCE_ALLOW_TEST_API_HOST=true` (mock/acceptance).

## Auth and configuration

| Package     | Configuration                                                                                                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WooCommerce | `OSVA_CONNECTOR_WOOCOMMERCE_STORE_URL`, `OSVA_CONNECTOR_WOOCOMMERCE_CONSUMER_KEY`, `OSVA_CONNECTOR_WOOCOMMERCE_CONSUMER_SECRET`; optional allowlists (`ALLOWED_PRODUCT_IDS`, `ALLOWED_ORDER_IDS`, writable field allowlist); `WRITE_ENABLED` + host write approval; `INCLUDE_ORDER_PII`; `ALLOW_HTTP_LOCALHOST` for tests |
| BigCommerce | `OSVA_CONNECTOR_BIGCOMMERCE_STORE_HASH`, `OSVA_CONNECTOR_BIGCOMMERCE_ACCESS_TOKEN`; optional product/order/category-tree allowlists; same write and PII gates; test API host flag above                                                                                                                                   |

Agents cannot override store URL, API host, or credentials via tool input.

## Security controls (B4.5)

| Control                        | WooCommerce                                                                         | BigCommerce                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Redirect rejection             | Yes (`redirect: manual`, 3xx → error)                                               | Same                                                          |
| Empty numeric allowlist = deny | Yes                                                                                 | Yes                                                           |
| Order PII redaction            | Customer notes redacted unless env enabled                                          | Provider-normalized summaries                                 |
| Mutation gates                 | `WRITE_ENABLED` + `HOST_WRITES_APPROVED`; field/status allowlists                   | Same                                                          |
| No mutation retries            | PUT/POST never retry on 5xx                                                         | Same                                                          |
| Pagination                     | `X-WP-Total` / `X-WP-TotalPages` → `pageInfo`                                       | v3 `meta.pagination` / v2 count headers                       |
| Malformed JSON                 | Mapped to `PROVIDER_ERROR`                                                          | Same                                                          |
| Credential redaction           | Basic auth secrets in error mapper                                                  | Access token in error mapper                                  |
| Output budget                  | 256 KiB structured JSON cap + list packing                                          | Same                                                          |
| SSRF / host pinning            | Store URL parsing (no creds/query/fragment); request origin must match pinned store | Fixed production API host; path prefix under `/stores/{hash}` |

## Tests and verification (this task)

| Package     | Vitest files | Tests  |
| ----------- | ------------ | ------ |
| WooCommerce | 13           | **35** |
| BigCommerce | 11           | **22** |

**Security-focused unit coverage (representative files):**

| Topic                | WooCommerce                                                                  | BigCommerce                                        |
| -------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| Redirect rejection   | `woocommerce-rest-client.security.test.ts`                                   | `bigcommerce-rest-client.security.test.ts`         |
| Empty allowlist      | `id-allowlist.test.ts`, `config.test.ts`                                     | `id-allowlist.test.ts`                             |
| PII redaction        | `normalize-pii.test.ts`                                                      | order summaries via connector mock tests           |
| Mutation gates       | `host-approval-not-in-tool-input.test.ts`, `connector-fake-provider.test.ts` | same                                               |
| No mutation retries  | `woocommerce-rest-client.security.test.ts`                                   | `bigcommerce-rest-client.security.test.ts`         |
| Pagination           | `normalize-pagination.test.ts`                                               | mock HTTP integration tests                        |
| Malformed JSON       | `woocommerce-rest-client.security.test.ts`                                   | `bigcommerce-rest-client.security.test.ts`         |
| Credential redaction | `map-woocommerce-error.test.ts`                                              | `map-bigcommerce-error.test.ts`                    |
| Output budget        | `output-budget.test.ts`                                                      | `output-budget.test.ts`                            |
| Store URL SSRF       | `woocommerce-base-url.test.ts`                                               | —                                                  |
| Fixed API host       | —                                                                            | `bigcommerce-fixed-host.test.ts`, `config.test.ts` |

### Commands run (2026-11-08, Windows)

```bash
pnpm --filter @osva-ai/connector-woocommerce lint
pnpm --filter @osva-ai/connector-bigcommerce lint
pnpm --filter @osva-ai/connector-woocommerce typecheck
pnpm --filter @osva-ai/connector-bigcommerce typecheck
pnpm --filter @osva-ai/connector-woocommerce test    # 35 passed
pnpm --filter @osva-ai/connector-bigcommerce test    # 22 passed
pnpm --filter @osva-ai/connector-woocommerce build
pnpm --filter @osva-ai/connector-bigcommerce build
pnpm test:package-acceptance:woocommerce              # passed
pnpm test:package-acceptance:bigcommerce               # passed
pnpm verify:boundaries                                # passed
pnpm install --frozen-lockfile --config.node-linker=hoisted  # passed (Windows)
pnpm format:check                                     # passed
```

`pnpm install --frozen-lockfile --config.node-linker=hoisted` **passed** on this workstation after a clean reinstall (Windows symlink/hard-link issues required `--node-linker=hoisted`; default isolated linker failed with `ERR_PNPM_PACKAGE_MANAGER_SYMLINK_FAILED`). **Lockfile importers verified** in `pnpm-lock.yaml`: `packages/woocommerce:` and `packages/bigcommerce:` entries present (lines ~1261 and ~261).

## Packaged MCP acceptance

- **WooCommerce:** `osva-ai-connector-woocommerce-0.1.0.tgz`, isolated npm install, MCP `tools/list` smoke — **passed**
- **BigCommerce:** `osva-ai-connector-bigcommerce-0.1.0.tgz`, isolated npm install, MCP `tools/list` smoke — **passed**

## Status matrix

| Package                          | Implemented | Unit tested | Packaged acceptance | CI workflow                                     | Live smoke           | Published                |
| -------------------------------- | ----------- | ----------- | ------------------- | ----------------------------------------------- | -------------------- | ------------------------ |
| `@osva-ai/connector-woocommerce` | Yes         | Yes (35)    | Yes                 | `npm-release-woocommerce.yml` (dry-run default) | Deferred (mock-only) | No (`0.1.0` source-only) |
| `@osva-ai/connector-bigcommerce` | Yes         | Yes (22)    | Yes                 | `npm-release-bigcommerce.yml` (dry-run default) | Deferred (mock-only) | No (`0.1.0` source-only) |

## Deferred validation

- Live WooCommerce/BigCommerce merchant credentials (CI and local tests use hermetic mock HTTP servers only).
- npm bootstrap / Trusted Publisher for the two new package names.
- Default `pnpm install` on Windows without `node-linker=hoisted` may still fail on symlink creation; CI uses Linux.

## npm publication readiness

Packages **lint**, **typecheck** (strict `src/`), **test**, **build**, and pass **package acceptance** + **boundary** checks. Release workflows exist with `workflow_dispatch` and `dry_run` default **true**.

## Recommended PR metadata

**Title:** `feat(connectors): add WooCommerce and BigCommerce MCP packages (B4.5)`

**Commit message (suggested):**

```
Add WooCommerce and BigCommerce commerce MCP connectors with strict TypeScript and B4.5 security tests.

Introduces @osva-ai/connector-woocommerce (10 tools) and @osva-ai/connector-bigcommerce (10 tools),
bounded REST adapters, SSRF-pinned store URL / fixed BC host, security unit tests, package acceptance,
install/release docs, and manual npm workflows. Repository connector count 31 → 33.
```
