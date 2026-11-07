# Release checklist — `@osva-ai/connector-exa`

**B3 verified publication (2026-11-08):** `@osva-ai/connector-exa@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**. Record: [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md). Workflow: [npm-release-exa.yml](../.github/workflows/npm-release-exa.yml).

- [ ] `pnpm --filter @osva-ai/connector-exa format:check`
- [ ] `pnpm --filter @osva-ai/connector-exa lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-exa test`
- [ ] `pnpm --filter @osva-ai/connector-exa build`
- [ ] `pnpm test:package-acceptance:exa`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/exa/src/constants.ts`
- [ ] `pnpm test:package-acceptance:registry-b3`
- [ ] `npm view @osva-ai/connector-exa@0.1.0 version` → `0.1.0`
