# Release checklist — `@osva-ai/connector-zoho-crm`

- [ ] `pnpm --filter @osva-ai/connector-zoho-crm` lint, typecheck, test, build
- [ ] `pnpm test:package-acceptance:zoho-crm`
- [ ] `CONNECTOR_VERSION` matches `package.json` `0.1.0`
- [ ] `bin.osva-connector-zoho-crm` → `dist/stdio.js`
- [ ] Manual workflow `.github/workflows/npm-release-zoho-crm.yml` with `dry_run=true` first
