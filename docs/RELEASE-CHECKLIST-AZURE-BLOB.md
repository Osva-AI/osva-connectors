# Release checklist — `@osva-ai/connector-azure-blob`

Workflow: [npm-release-azure-blob.yml](../.github/workflows/npm-release-azure-blob.yml). Install notes: [INSTALL-AZURE-BLOB.md](./INSTALL-AZURE-BLOB.md).

- [ ] `pnpm --filter @osva-ai/connector-azure-blob format:check`
- [ ] `pnpm --filter @osva-ai/connector-azure-blob lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-azure-blob test`
- [ ] `pnpm --filter @osva-ai/connector-azure-blob build`
- [ ] `pnpm test:package-acceptance:azure-blob`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/azure-blob/src/constants.ts`
- [ ] No Azure secrets or `.env` files in the packed tarball
- [ ] Dry-run the release workflow before any upload (`dry_run=true`)
- [ ] Real upload requires `dry_run=false`, `confirm_publish=true`, and a trusted publisher or explicit `use_npm_token=true`
