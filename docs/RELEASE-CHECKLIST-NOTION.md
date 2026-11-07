# Release checklist — `@osva-ai/connector-notion`

**B3 verified publication (2026-11-08):** `@osva-ai/connector-notion@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**. Record: [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md). Workflow: [npm-release-notion.yml](../.github/workflows/npm-release-notion.yml).

- [ ] `pnpm --filter @osva-ai/connector-notion format:check`
- [ ] `pnpm --filter @osva-ai/connector-notion lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-notion test`
- [ ] `pnpm --filter @osva-ai/connector-notion build`
- [ ] `pnpm test:package-acceptance:notion`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/notion/src/constants.ts`
- [ ] `pnpm test:package-acceptance:registry-b3`
- [ ] `npm view @osva-ai/connector-notion@0.1.0 version` → `0.1.0`
