# Release checklist — `@osva-ai/connector-salesforce`

- [ ] `pnpm --filter @osva-ai/connector-salesforce` lint, typecheck, test, build
- [ ] `pnpm test:package-acceptance:salesforce`
- [ ] `CONNECTOR_VERSION` matches `package.json` `0.1.0`
- [ ] `bin.osva-connector-salesforce` → `dist/stdio.js`
- [ ] Manual workflow `.github/workflows/npm-release-salesforce.yml` with `dry_run=true` first
