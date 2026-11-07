# Implementation report — B3.3 Research & web intelligence (`feat/b3-research-intelligence`)

## Summary

Three new publishable packages under OSVA Connector Profile V1:

- [`@osva-ai/connector-exa`](../packages/exa) — **3** MCP tools (search, contents, answer).
- [`@osva-ai/connector-tavily`](../packages/tavily) — **3** MCP tools (search, extract, crawl).
- [`@osva-ai/connector-firecrawl`](../packages/firecrawl) — **5** MCP tools (scrape, search, map, crawl start/status).

Workspace grows from **19 → 22** connector packages. All pin **`@osva-ai/connector-sdk@1.1.4`**.

## Phase 1 — Build vs reuse

| Provider      | Decision                                       | Rationale                                                                                                                              |
| ------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Exa**       | Thin REST adapter (`api.exa.ai`, `x-api-key`)  | Avoid `exa-js` coupling; full control over bounded bodies, retries, output budgets, and OSVA tool contracts. No duplicate of Exa MCP.  |
| **Tavily**    | Thin REST adapter (`api.tavily.com`, Bearer)   | Stable POST `/search`, `/extract`, `/crawl`; conservative crawl/extract caps in connector; no official MCP fork.                       |
| **Firecrawl** | Thin REST adapter (Firecrawl **v2** base path) | Fixed scrape/search/map/crawl + GET crawl status; separate start/status tools (no long MCP poll); no interact/browser/webhook surface. |

Official SDKs were not added — each package is self-contained with bounded `fetch` and shared **patterns** (not a new shared HTTP package).

## Tool inventory

| Package   | Tools                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Exa       | `exa.search`, `exa.contents.get`, `exa.answer`                                                             |
| Tavily    | `tavily.search`, `tavily.extract`, `tavily.crawl`                                                          |
| Firecrawl | `firecrawl.scrape`, `firecrawl.search`, `firecrawl.map`, `firecrawl.crawl.start`, `firecrawl.crawl.status` |

**Not implemented:** Exa `findSimilar` (deprecated guidance). Firecrawl interact/agent/webhooks.

## Provider API versions and limitations

- **Exa:** Public API `https://api.exa.ai` — POST `/search`, `/contents`, `/answer`. Answer is LLM-grounded on search; connector attaches `answerDisclaimer` and does not retry answer calls.
- **Tavily:** `https://api.tavily.com/` — POST `/search`, `/extract`, `/crawl`. Crawl limits clamped below provider maxima (`max_depth` ≤ 3, `limit` ≤ 25, `max_breadth` ≤ 20).
- **Firecrawl:** `https://api.firecrawl.dev/v2` — POST `/scrape`, `/search`, `/map`, `/crawl`; GET `/crawl/{id}` with optional `skip` and provider `next` URL pagination (host allowlisted at request time).

Provider-side fetch/crawl egress cannot be fully constrained from the OSVA process; install docs document the trust boundary.

## Shared vs provider-specific code

No new monorepo shared package. Per-package copies of:

- Bounded HTTP response reads, timeouts, read-only retries (where safe)
- `output-budget.ts` (256 KiB structured JSON cap)
- `map-*-error.ts` with credential redaction
- HTTPS URL validation for user-supplied targets
- Mock HTTP servers + MCP fake-provider tests

## Security policies and limits

| Control           | Implementation                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Credentials       | `OSVA_CONNECTOR_EXA_API_KEY`, `OSVA_CONNECTOR_TAVILY_API_KEY`, `OSVA_CONNECTOR_FIRECRAWL_API_KEY` via env only |
| API hosts         | Fixed production hosts; test override to localhost HTTP for mocks only                                         |
| URL safety        | HTTPS, no loopback/private/metadata targets for agent-supplied URLs                                            |
| Output            | Structured output budget; per-field truncation metadata where applicable                                       |
| Cost-bearing ops  | Conservative result/url/crawl limits; no auto-retry on ambiguous write-like ops                                |
| Untrusted content | Marked in descriptions; answer not presented as verified fact                                                  |

## Files added / changed (high level)

- `packages/exa/**`, `packages/tavily/**`, `packages/firecrawl/**` (new)
- `scripts/connector-packages.mjs`, `scripts/package-acceptance-{exa,tavily,firecrawl}*.mjs`, `scripts/package-acceptance-npm-dry-run.mjs`
- `.github/workflows/npm-release-{exa,tavily,firecrawl}.yml`
- `docs/INSTALL-{EXA,TAVILY,FIRECRAWL}.md`, `docs/RELEASE-CHECKLIST-*.md`
- `docs/compatibility.md`, `README.md`, root `package.json`, `pnpm-lock.yaml`

## Verification (executed)

| Step       | Command                                                                                                              | Result    |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| Prettier   | `pnpm exec prettier --write` (packages + docs + scripts + lockfile)                                                  | OK        |
| Format     | `pnpm format:check`                                                                                                  | OK        |
| Lint       | `pnpm --filter @osva-ai/connector-exa --filter @osva-ai/connector-tavily --filter @osva-ai/connector-firecrawl lint` | OK        |
| Typecheck  | same filters `typecheck`                                                                                             | OK        |
| Unit tests | exa **23**, tavily **30**, firecrawl **18** (direct `vitest run`, not full workspace sweep)                          | **71** OK |
| Build      | same filters `build`                                                                                                 | OK        |
| Acceptance | `node scripts/package-acceptance-exa.mjs`                                                                            | OK smoke  |
| Acceptance | `node scripts/package-acceptance-tavily.mjs`                                                                         | OK smoke  |
| Acceptance | `node scripts/package-acceptance-firecrawl.mjs`                                                                      | OK smoke  |
| Boundaries | `pnpm verify:boundaries`                                                                                             | OK        |
| Whitespace | `git diff --check`                                                                                                   | OK        |

**Deferred:** Live Exa/Tavily/Firecrawl production API calls (no real API keys in CI).

## Known limitations (v0.1.0)

- Client-side URL checks do not guarantee provider egress paths or redirect behavior on provider infrastructure.
- Firecrawl crawl status pagination follows a single `next` hop per call; hosts must remain on `api.firecrawl.dev`.
- Tavily crawl cost scales with provider pricing; connector clamps inputs but cannot enforce provider billing caps.
- Exa `exa.answer` is single-shot (no streaming).

## npm release readiness

Packages at **`0.1.0`**, OIDC-style release workflows present, default `dry_run: true`, empty `NODE_AUTH_TOKEN` avoided on OIDC path. **Not published** in this task.

Registry inventory (**2026-11-07**, `npm view`): **22** packages in source; **15** published on npm; **7** source-only (Gmail, Google Calendar, Notion, Linear, Exa, Tavily, Firecrawl). See [compatibility.md](./compatibility.md#release-status).

## Closeout audit (security & documentation)

| Finding                                                 | Fix                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Stale **8/22 published** counts in compatibility docs   | Verified registry; updated to **15 published / 7 source-only**                         |
| Firecrawl user URLs lacked private/metadata host checks | `parseHttpUrl` now HTTPS-only with SSRF-style host blocking + regression tests         |
| Firecrawl POST billable ops retried on transient 5xx    | Scrape/search/map/crawl start use single-shot `requestJsonAttempt` (architecture test) |
| Tavily **402** payment required not mapped distinctly   | `map-tavily-error` handles 402 + regression test                                       |
| Firecrawl README listed metered tools as generic “Read” | README + tool descriptions state **metered** credits / egress trust boundary           |

## Recommended commit message

```
feat(connectors): add Exa, Tavily, and Firecrawl MCP packages (B3.3)

Introduce research and web intelligence connectors with Profile V1 stdio
tools, bounded provider adapters, acceptance scripts, and release workflows.
```

## Recommended PR title

**B3.3: Exa + Tavily + Firecrawl research intelligence MCP connectors**
