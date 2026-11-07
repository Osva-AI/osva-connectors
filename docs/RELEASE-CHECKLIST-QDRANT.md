# Release checklist — `@osva-ai/connector-qdrant`

**B3 verified publication (2026-11-08):** `@osva-ai/connector-qdrant@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**. Record: [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md). Workflow: [npm-release-qdrant.yml](../.github/workflows/npm-release-qdrant.yml).

- [ ] `pnpm --filter @osva-ai/connector-qdrant format:check`
- [ ] `pnpm --filter @osva-ai/connector-qdrant lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-qdrant test`
- [ ] `pnpm --filter @osva-ai/connector-qdrant build`
- [ ] `pnpm test:package-acceptance:qdrant`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/qdrant/src/constants.ts`
- [ ] `pnpm test:package-acceptance:registry-b3`
- [ ] `npm view @osva-ai/connector-qdrant@0.1.0 version` → `0.1.0`
