# Implementation report — B4.3 Vector databases (`feat/b4-vector-databases`)

## Summary

Two new publishable packages under OSVA Connector Profile V1:

- [`@osva-ai/connector-qdrant`](../packages/qdrant) — **7** MCP tools (6 read, 1 gated mutation).
- [`@osva-ai/connector-pinecone`](../packages/pinecone) — **7** MCP tools (6 read, 1 gated mutation).

Repository connector count: **27 → 29**. Prior **22** npm publications unchanged (these packages are source-only until release). Both pin **`@osva-ai/connector-sdk@1.1.4`**, target **Node 24+** / **pnpm 12.4.1**, and follow B3/B4 patterns (thin REST, Zod + JSON Schema, bounded HTTP, credential redaction, stdio binaries, mock HTTP fixtures, package acceptance, manual OIDC release workflows).

**Not committed, not published, not pushed** (per task).

## Phase 1 — Build vs reuse

| Provider     | Decision                                 | Rationale                                                                                                                                   |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qdrant**   | Thin REST adapter (`api-key` header)     | Full control over URL allowlisting, bounded bodies, read retries, output budgets, and OSVA tool contracts. No official Qdrant MCP fork.     |
| **Pinecone** | Thin REST adapter (control + data plane) | Avoid `@pinecone-database/pinecone` coupling; explicit `X-Pinecone-Api-Version: 2025-04`; host validation and index-type guards in-process. |

Official TypeScript SDKs were not added. No new shared monorepo HTTP package — patterns copied per package (as in Exa/Tavily/Firecrawl).

### Change-impact inventory

| Area              | Impact                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| Packages (new)    | `packages/qdrant/**`, `packages/pinecone/**`                                                                        |
| Workspace scripts | `scripts/connector-packages.mjs`, `package-acceptance-{qdrant,pinecone}*.mjs`, `package-acceptance-npm-dry-run.mjs` |
| CI release        | `.github/workflows/npm-release-{qdrant,pinecone}.yml`                                                               |
| Docs              | `INSTALL-*`, `RELEASE-CHECKLIST-*`, `compatibility.md`, `README.md`, this report                                    |
| Prior connectors  | **No source changes** to existing 27 packages (integration-only diff)                                               |

## Provider API versions and routes

### Qdrant (REST, database API)

- Base URL: host env only (`OSVA_CONNECTOR_QDRANT_URL`), never from tool input.
- Auth: optional `api-key` header when `OSVA_CONNECTOR_QDRANT_API_KEY` is set (Qdrant database API — not Cloud management API).
- Routes used:
  - `GET /collections`
  - `GET /collections/{collection_name}`
  - `POST /collections/{collection_name}/points` (retrieve)
  - `POST /collections/{collection_name}/points/scroll`
  - `POST /collections/{collection_name}/points/query`
  - `POST /collections/{collection_name}/points/count`
  - `PUT /collections/{collection_name}/points` (upsert, `wait=true` query param)
- Production: HTTPS required unless `OSVA_CONNECTOR_QDRANT_ALLOW_LOCAL_HTTP=true` for `localhost` / `127.0.0.1` development.

### Pinecone (2025-04)

- Control plane: `https://api.pinecone.io` with `Api-Key` + `X-Pinecone-Api-Version: 2025-04`.
  - `GET /indexes`, `GET /indexes/{name}`
- Data plane: HTTPS origin derived from describe response `host` only; validated `*.pinecone.io` (loopback override for tests).
  - `POST /describe_index_stats`
  - `POST /query`
  - `GET /vectors/fetch` (IDs in query string)
  - `GET /vectors/list`
  - `POST /vectors/upsert`

## Tool inventory

### Qdrant

| Tool                     | Mode                  |
| ------------------------ | --------------------- |
| `qdrant.collection.list` | Read                  |
| `qdrant.collection.get`  | Read                  |
| `qdrant.point.get`       | Read                  |
| `qdrant.point.scroll`    | Read                  |
| `qdrant.point.query`     | Read (dense vector)   |
| `qdrant.point.count`     | Read                  |
| `qdrant.point.upsert`    | Mutating (dual gates) |

### Pinecone

| Tool                      | Mode                   |
| ------------------------- | ---------------------- |
| `pinecone.index.list`     | Read                   |
| `pinecone.index.describe` | Read                   |
| `pinecone.index.stats`    | Read                   |
| `pinecone.vector.query`   | Read (dense only)      |
| `pinecone.vector.fetch`   | Read                   |
| `pinecone.vector.list`    | Read (where supported) |
| `pinecone.vector.upsert`  | Mutating (dual gates)  |

**Deferred:** collection/index administration, deletes, embedding generation, cross-index orchestration, integrated-embedding / schema-backed document search tools.

## Supported vector and index types

| Connector | v0.1.0 scope                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qdrant    | Numeric dense vectors; numeric and string point IDs; named-vector `using` not exposed in tool surface (default collection vector).                                                |
| Pinecone  | **Dense** indexes only for `pinecone.vector.query` and `.upsert`. **Sparse**, **integrated-embedding** (`spec.embed`), and non-dense `vector_type` rejected with explicit errors. |

## Authentication and host configuration

| Package  | Required / notable env                                                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qdrant   | `OSVA_CONNECTOR_QDRANT_URL`; optional `OSVA_CONNECTOR_QDRANT_API_KEY`; `OSVA_CONNECTOR_QDRANT_ALLOW_LOCAL_HTTP`; write: `OSVA_CONNECTOR_QDRANT_WRITE_ENABLED`, `OSVA_CONNECTOR_QDRANT_HOST_WRITES_APPROVED` |
| Pinecone | `OSVA_CONNECTOR_PINECONE_API_KEY`; write: `OSVA_CONNECTOR_PINECONE_WRITE_ENABLED`, `OSVA_CONNECTOR_PINECONE_HOST_WRITES_APPROVED`                                                                           |

## Tenant and resource isolation

| Control             | Implementation                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Qdrant collections  | Tri-state `OSVA_CONNECTOR_QDRANT_ALLOWED_COLLECTIONS` (`undefined` = unrestricted; `""` = deny all; list = allow only) |
| Pinecone indexes    | Tri-state `OSVA_CONNECTOR_PINECONE_ALLOWED_INDEXES`                                                                    |
| Pinecone namespaces | `OSVA_CONNECTOR_PINECONE_ALLOWED_NAMESPACES` (`index:ns1,ns2` segments)                                                |
| Endpoints           | Qdrant URL and Pinecone control plane fixed; Pinecone data-plane host from describe + hostname policy only             |

Mutations require **non-empty** allowlist when env is set; dual host write gates. Agents cannot supply URLs, credentials, or write approval via tool inputs.

## Metadata filters

Restricted validators (`metadata-filter.ts`) — arbitrary provider filter JSON is **not** forwarded:

- **Qdrant:** `must` / `should` / `must_not` with `match.value`, `range`, `is_empty`, `is_null`, `has_id`.
- **Pinecone:** field keys with `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin` and bounded nesting.

## Vector and safety limits (both)

- Max vector dimension **16,384**; finite components only.
- Bounded top-K / scroll limits, batch upsert caps, HTTP response bytes (**2 MiB**), structured output budget (**256 KiB**).
- Read-only bounded retries; **no** automatic retries on upsert (ambiguous write mapping).
- Credential redaction in errors; cancellation via MCP `AbortSignal`.

## Verification (executed locally)

| Step           | Command                                                       | Result    |
| -------------- | ------------------------------------------------------------- | --------- |
| Prettier write | `pnpm exec prettier --write` (changed packages/docs)          | OK        |
| Format         | `pnpm format:check`                                           | OK        |
| Lint           | `pnpm --filter @osva-ai/connector-qdrant lint` (and pinecone) | OK        |
| Typecheck      | same filters `typecheck`                                      | OK        |
| Unit tests     | Qdrant **24**, Pinecone **19**                                | **43** OK |
| Build          | same filters `build`                                          | OK        |
| Acceptance     | `pnpm test:package-acceptance:qdrant`                         | OK smoke  |
| Acceptance     | `pnpm test:package-acceptance:pinecone`                       | OK smoke  |
| Boundaries     | `pnpm verify:boundaries`                                      | OK        |
| Whitespace     | `git diff --check`                                            | OK        |

**Deferred:** Live Qdrant Cloud / Pinecone API calls (no real credentials in CI).

## Known limitations (v0.1.0)

- Qdrant hybrid / multi-stage query features and full filter grammar not exposed — subset only.
- Pinecone sparse, integrated-embedding, and schema-backed document indexes are **read-metadata only** (describe/list); vector tools reject them.
- `pinecone.vector.list` returns provider errors when index type does not support listing.
- Self-hosted Qdrant without TLS/auth is supported only via explicit local HTTP trust flag — not treated as production-ready.
- Qdrant and Pinecone relevance scores are provider-specific and not comparable across connectors.

## npm release readiness

Packages at **`0.1.0`**, OIDC-style release workflows present, default `dry_run: true`. **Not published** in this task.

## Recommended git messages (not executed)

**PR title:** `feat(connectors): add Qdrant and Pinecone vector database MCP connectors (B4.3)`

**Commit message:**

```
Add Qdrant and Pinecone vector DB connectors for bounded dense-vector RAG workflows.

Introduces @osva-ai/connector-qdrant and @osva-ai/connector-pinecone with host-controlled
allowlists, restricted metadata filters, and gated upserts; repository grows to 29 connectors.
```
