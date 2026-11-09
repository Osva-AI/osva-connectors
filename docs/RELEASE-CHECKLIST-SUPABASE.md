# Release checklist — `@osva-ai/connector-supabase`

**B4.9 source-only** until npm bootstrap. Workflow: [npm-release-supabase.yml](../.github/workflows/npm-release-supabase.yml).

- [ ] `pnpm --filter @osva-ai/connector-supabase format:check`
- [ ] `pnpm --filter @osva-ai/connector-supabase lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-supabase test`
- [ ] `pnpm --filter @osva-ai/connector-supabase build`
- [ ] `pnpm test:package-acceptance:supabase`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/supabase/src/constants.ts`
- [ ] Service-role / secret key rejection verified in tests
- [ ] No user JWTs in tarball
