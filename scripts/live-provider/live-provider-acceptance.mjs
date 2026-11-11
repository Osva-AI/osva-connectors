#!/usr/bin/env node
/**
 * B5.5A: Live provider acceptance harness (preflight by default; live traffic opt-in).
 *
 * Usage:
 *   node scripts/live-provider/live-provider-acceptance.mjs --matrix-only
 *   node scripts/live-provider/live-provider-acceptance.mjs --pilot
 *   node scripts/live-provider/live-provider-acceptance.mjs --connector aws-s3
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ACCEPTANCE_STATUS,
  buildLiveProviderMatrix,
  evaluateExitCode,
  renderLiveProviderMatrixDoc,
  runLiveProviderMatrix,
  writeLiveProviderReports,
} from "./live-provider-acceptance-core.mjs";
import { isLiveExecutionEnabled } from "./live-provider-gates.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);

const DEFAULT_REPORT_DIR = path.join(
  ROOT,
  "audit-results",
  "live-provider-acceptance",
);

function parseArgs(argv) {
  const flags = {
    help: false,
    matrixOnly: false,
    pilot: false,
    infrastructure: false,
    saas: false,
    mock: false,
    failOnBlocked: false,
    jsonOut: "",
    mdOut: "",
    matrixOut: "",
    connectors: [],
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--matrix-only") {
      flags.matrixOnly = true;
    } else if (arg === "--pilot") {
      flags.pilot = true;
    } else if (arg === "--infrastructure") {
      flags.infrastructure = true;
    } else if (arg === "--saas") {
      flags.saas = true;
    } else if (arg === "--mock") {
      flags.mock = true;
    } else if (arg === "--fail-on-blocked") {
      flags.failOnBlocked = true;
    } else if (arg === "--connector" && next) {
      flags.connectors.push(next);
      i += 1;
    } else if (arg.startsWith("--connector=")) {
      flags.connectors.push(arg.slice("--connector=".length));
    } else if (arg === "--json-out" && next) {
      flags.jsonOut = next;
      i += 1;
    } else if (arg.startsWith("--json-out=")) {
      flags.jsonOut = arg.slice("--json-out=".length);
    } else if (arg === "--md-out" && next) {
      flags.mdOut = next;
      i += 1;
    } else if (arg.startsWith("--md-out=")) {
      flags.mdOut = arg.slice("--md-out=".length);
    } else if (arg === "--matrix-out" && next) {
      flags.matrixOut = next;
      i += 1;
    } else if (arg.startsWith("--matrix-out=")) {
      flags.matrixOut = arg.slice("--matrix-out=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return flags;
}

function printHelp() {
  console.log(`live-provider-acceptance — B5.5C SaaS + B5.5B infrastructure

Defaults to preflight (no provider network calls).

Gates:
  OSVA_LIVE_PROVIDER_EXECUTE=1                        allow live read scenarios
  OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED=1             harness policy only in B5.5C
  OSVA_LIVE_PROVIDER_MUTATION_RUNNER_ENABLED=1        required for live writes (B5.5D)
  OSVA_LIVE_PROVIDER_RUN_MOCK_FIXTURES=1              run vitest (or --mock)

Usage:
  node scripts/live-provider/live-provider-acceptance.mjs --matrix-only
  node scripts/live-provider/live-provider-acceptance.mjs --saas
  node scripts/live-provider/live-provider-acceptance.mjs --saas --mock
  node scripts/live-provider/live-provider-acceptance.mjs --infrastructure
  node scripts/live-provider/live-provider-acceptance.mjs --connector stripe --mock

Options:
  --matrix-only       Emit 45-connector matrix only (no scenarios)
  --saas              Run 37 SaaS connectors (B5.5C)
  --infrastructure    Run 8 infrastructure connectors (B5.5B)
  --pilot             Run aws-s3, bigquery, github (legacy slice)
  --connector <dir>   Run one connector directory with a runner
  --mock              Include in-repo vitest fixture paths (can be slow)
  --fail-on-blocked   Exit nonzero when overall status is BLOCKED
  --json-out=PATH     JSON evidence (secrets redacted)
  --md-out=PATH       Markdown evidence
  --matrix-out=PATH   Write matrix markdown (docs/operations/...)
`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonOut =
    flags.jsonOut ||
    path.join(DEFAULT_REPORT_DIR, `live-provider-${stamp}.json`);
  const mdOut =
    flags.mdOut || path.join(DEFAULT_REPORT_DIR, `live-provider-${stamp}.md`);
  const matrixOut =
    flags.matrixOut ||
    path.join(ROOT, "docs", "operations", "live-provider-acceptance-matrix.md");

  if (flags.matrixOnly) {
    const matrix = await buildLiveProviderMatrix(ROOT);
    const report = {
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      mode: { matrixOnly: true },
      summary: { connectorsTotal: matrix.length },
      matrix,
      packages: [],
    };
    await writeLiveProviderReports(report, {
      json: jsonOut,
      markdown: mdOut,
      matrixDoc: matrixOut,
    });
    console.log(`live-provider-acceptance: matrix ${matrix.length} connectors`);
    console.log(`live-provider-acceptance: matrix doc ${matrixOut}`);
    return;
  }

  if (
    !flags.pilot &&
    !flags.infrastructure &&
    !flags.saas &&
    flags.connectors.length === 0
  ) {
    throw new Error(
      "Specify --saas, --infrastructure, --pilot, --connector <dir>, or --matrix-only",
    );
  }

  const report = await runLiveProviderMatrix({
    repoRoot: ROOT,
    directories: flags.connectors,
    pilotOnly: flags.pilot,
    infrastructureOnly: flags.infrastructure,
    saasOnly: flags.saas,
    includeMock: flags.mock,
  });

  await writeLiveProviderReports(report, {
    json: jsonOut,
    markdown: mdOut,
    matrixDoc: matrixOut,
  });

  console.log(
    `live-provider-acceptance: live=${isLiveExecutionEnabled()} executed=${report.summary.connectorsExecuted} failed=${report.summary.failed} blocked=${report.summary.blocked}`,
  );
  console.log(`live-provider-acceptance: json ${jsonOut}`);
  console.log(`live-provider-acceptance: md ${mdOut}`);

  for (const pkg of report.packages) {
    const bad = (pkg.scenarios ?? []).filter(
      (s) => s.status === ACCEPTANCE_STATUS.FAILED,
    );
    if (bad.length > 0) {
      console.error(
        `${pkg.directory}: FAILED scenarios: ${bad.map((s) => s.id).join(", ")}`,
      );
    }
  }

  process.exitCode = evaluateExitCode(report, {
    failOnBlocked: flags.failOnBlocked,
  });
}

const entryPath = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(entryPath)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
