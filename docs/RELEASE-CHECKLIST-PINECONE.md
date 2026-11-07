# Release checklist — `@osva-ai/connector-pinecone`

**B3 verified publication (2026-11-08):** `@osva-ai/connector-pinecone@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**. Record: [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md). Workflow: [npm-release-pinecone.yml](../.github/workflows/npm-release-pinecone.yml).

- [ ] `pnpm --filter @osva-ai/connector-pinecone format:check`
- [ ] `pnpm --filter @osva-ai/connector-pinecone lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-pinecone test`
- [ ] `pnpm --filter @osva-ai/connector-pinecone build`
- [ ] `pnpm test:package-acceptance:pinecone`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/pinecone/src/constants.ts`
- [ ] `pnpm test:package-acceptance:registry-b3`
- [ ] `npm view @osva-ai/connector-pinecone@0.1.0 version` → `0.1.0`
