# Release checklist — `@osva-ai/connector-linear`

**B3 verified publication (2026-11-08):** `@osva-ai/connector-linear@0.1.0` on npm with **`@osva-ai/connector-sdk@1.1.4`**. Record: [B3_PUBLICATION_RECORD.md](./B3_PUBLICATION_RECORD.md). Workflow: [npm-release-linear.yml](../.github/workflows/npm-release-linear.yml).

- [ ] `pnpm --filter @osva-ai/connector-linear format:check`
- [ ] `pnpm --filter @osva-ai/connector-linear lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-linear test`
- [ ] `pnpm --filter @osva-ai/connector-linear build`
- [ ] `pnpm test:package-acceptance:linear`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/linear/src/constants.ts`
- [ ] `pnpm test:package-acceptance:registry-b3`
- [ ] `npm view @osva-ai/connector-linear@0.1.0 version` → `0.1.0`
