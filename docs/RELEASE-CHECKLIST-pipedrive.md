# Release checklist — `@osva-ai/connector-pipedrive`

- [ ] `pnpm --filter @osva-ai/connector-pipedrive` lint, typecheck, test, build
- [ ] `pnpm test:package-acceptance:pipedrive`
- [ ] `CONNECTOR_VERSION` matches `package.json` `0.1.0`
- [ ] `bin.osva-connector-pipedrive` → `dist/stdio.js`
- [ ] Manual workflow `.github/workflows/npm-release-pipedrive.yml` with `dry_run=true` first
