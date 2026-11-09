# Release checklist — `@osva-ai/connector-aws-s3`

Workflow: [npm-release-aws-s3.yml](../.github/workflows/npm-release-aws-s3.yml). Install notes: [INSTALL-AWS-S3.md](./INSTALL-AWS-S3.md).

- [ ] `pnpm --filter @osva-ai/connector-aws-s3 format:check`
- [ ] `pnpm --filter @osva-ai/connector-aws-s3 lint` and `typecheck`
- [ ] `pnpm --filter @osva-ai/connector-aws-s3 test`
- [ ] `pnpm --filter @osva-ai/connector-aws-s3 build`
- [ ] `pnpm test:package-acceptance:aws-s3`
- [ ] `pnpm verify:boundaries`
- [ ] Version matches `CONNECTOR_VERSION` in `packages/aws-s3/src/constants.ts`
- [ ] No AWS credentials or `.env` files in the packed tarball
- [ ] Dry-run the release workflow before any upload (`dry_run=true`)
- [ ] Real upload requires `dry_run=false`, `confirm_publish=true`, and a trusted publisher or explicit `use_npm_token=true`
