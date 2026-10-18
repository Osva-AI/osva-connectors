# Contributing

Thank you for contributing to `osva-connectors`.

## Development setup

1. Install Node.js 24+ and pnpm 12.4.1.
2. Run `pnpm install` at the repository root.
3. Use package-local scripts (`pnpm --filter @osva-ai/connector-github <script>`) or root orchestration scripts.

## Pull requests

- Keep changes scoped to a single connector or shared repository concern.
- Run formatting, lint, typecheck, tests, and build before opening a PR.
- Do not commit credentials, `.env` files, or live tokens.
- Add focused tests for behavior and security boundaries.

## Code style

- TypeScript strict mode, ESM, NodeNext module resolution.
- Match existing formatting (Prettier) and ESLint rules.

## Security

Report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md).
