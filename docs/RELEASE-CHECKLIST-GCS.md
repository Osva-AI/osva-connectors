# Release checklist — `@osva-ai/connector-gcs`

Workflow: [npm-release-gcs.yml](../.github/workflows/npm-release-gcs.yml). Install notes: [INSTALL-GCS.md](./INSTALL-GCS.md).

- [ ] `pnpm --filter @osva-ai/connector-gcs format:check`
- [ ] `pnpm --filter @osva-ai/connector-gcs lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-gcs test`
- [ ] `pnpm --filter @osva-ai/connector-gcs build`
- [ ] `pnpm test:package-acceptance:gcs`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/gcs/src/constants.ts`
- [ ] No GCP service-account JSON or `.env` files in the packed tarball
- [ ] Dry-run the release workflow before any upload (`dry_run=true`)
- [ ] Real upload requires `dry_run=false`, `confirm_publish=true`, and a trusted publisher or explicit `use_npm_token=true`
