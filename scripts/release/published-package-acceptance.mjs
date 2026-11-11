#!/usr/bin/env node
/**
 * B5.4: Install exact npm versions outside the monorepo and validate published artifacts.
 *
 * Usage:
 *   node scripts/release/published-package-acceptance.mjs <package> <version>
 *   node scripts/release/published-package-acceptance.mjs --wave-b5
 *   node scripts/release/published-package-acceptance.mjs --all-connectors
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  acceptPublishedPackage,
  binNameFromBinMap,
  buildConnectorTargets,
  B5_WAVE_DIRECTORIES,
  renderMarkdownReport,
  runPublishedAcceptanceMatrix,
  slugFromDirectory,
  STATUS,
} from "./published-package-acceptance-core.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);
const DEFAULT_REPORT_DIR = path.join(
  ROOT,
  "audit-results",
  "published-acceptance",
);

function parseArgs(argv) {
  const flags = {
    waveB5: false,
    allConnectors: false,
    expectLatest: false,
    keepWorkDir: false,
    concurrency: Number(
      process.env.OSVA_PUBLISHED_ACCEPTANCE_CONCURRENCY ?? "1",
    ),
    jsonOut: "",
    mdOut: "",
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--wave-b5") {
      flags.waveB5 = true;
    } else if (arg === "--all-connectors") {
      flags.allConnectors = true;
    } else if (arg === "--expect-latest") {
      flags.expectLatest = true;
    } else if (arg === "--keep") {
      flags.keepWorkDir = true;
    } else if (arg === "--concurrency" && next) {
      flags.concurrency = Number(next);
      i += 1;
    } else if (arg.startsWith("--concurrency=")) {
      flags.concurrency = Number(arg.slice("--concurrency=".length));
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
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function printHelp() {
  console.log(`published-package-acceptance — registry install acceptance (B5.4)

Usage:
  node scripts/release/published-package-acceptance.mjs <@scope/name> <exact-version>
  node scripts/release/published-package-acceptance.mjs --wave-b5 [--all-connectors]
  node scripts/release/published-package-acceptance.mjs --all-connectors

Options:
  --wave-b5          Run B5 release wave first (${B5_WAVE_DIRECTORIES.length} packages, workspace versions)
  --all-connectors   After wave (or alone), run all 45 connectors at workspace versions
  --expect-latest    Fail when dist-tag latest does not match tested version
  --concurrency=N    Parallel package installs (default 1)
  --json-out=PATH    Write JSON report
  --md-out=PATH      Write Markdown report
  --keep             Keep temp install dirs (also OSVA_KEEP_ACCEPTANCE_DIR=1)
`);
}

async function targetFromPositional(name, version) {
  const connectors = await buildConnectorTargets(ROOT, { waveOnly: false });
  const match = connectors.find((c) => c.name === name);
  if (match) {
    return { ...match, version };
  }
  const directory = name.replace("@osva-ai/connector-", "");
  const binName = `osva-connector-${directory}`;
  return {
    directory,
    slug: slugFromDirectory(directory),
    name,
    version,
    binName,
    wave: B5_WAVE_DIRECTORIES.includes(directory),
  };
}

async function resolveTargets(flags, positional) {
  if (positional.length >= 2) {
    return [await targetFromPositional(positional[0], positional[1])];
  }
  if (flags.allConnectors) {
    return buildConnectorTargets(ROOT, { waveOnly: false });
  }
  if (flags.waveB5) {
    return buildConnectorTargets(ROOT, { waveOnly: true });
  }
  throw new Error(
    "Specify <package> <version>, or --wave-b5, or --all-connectors",
  );
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonOut =
    flags.jsonOut ||
    path.join(DEFAULT_REPORT_DIR, `published-acceptance-${stamp}.json`);
  const mdOut =
    flags.mdOut ||
    path.join(DEFAULT_REPORT_DIR, `published-acceptance-${stamp}.md`);

  const targets = await resolveTargets(flags, positional);
  const concurrency = Number.isFinite(flags.concurrency)
    ? Math.max(1, flags.concurrency)
    : 1;

  console.log(
    `published-package-acceptance: ${targets.length} package(s), concurrency=${concurrency}`,
  );

  const report = await runPublishedAcceptanceMatrix({
    repoRoot: ROOT,
    targets,
    concurrency,
    expectLatest: flags.expectLatest,
    keepWorkDir: flags.keepWorkDir,
    reportPaths: { json: jsonOut, markdown: mdOut },
  });

  console.log(`published-package-acceptance: report ${jsonOut}`);
  console.log(`published-package-acceptance: report ${mdOut}`);
  console.log(
    `published-package-acceptance: packages passed=${report.summary.packagesPassed} failed=${report.summary.packagesFailed} skipped=${report.summary.packagesSkipped}`,
  );
  console.log(
    `published-package-acceptance: checks skipped=${report.summary.checksSkipped}`,
  );

  const failed = report.packages.filter((p) => p.overall === STATUS.FAILED);
  if (failed.length > 0) {
    for (const pkg of failed) {
      const bad = pkg.checks.filter((c) => c.status === STATUS.FAILED);
      console.error(
        `${pkg.name}@${pkg.version} FAILED: ${bad.map((c) => c.id).join(", ")}`,
      );
    }
    process.exitCode = 1;
  }
}

export {
  acceptPublishedPackage,
  buildConnectorTargets,
  renderMarkdownReport,
  runPublishedAcceptanceMatrix,
} from "./published-package-acceptance-core.mjs";

export function connectorBinFromManifest(manifest) {
  return binNameFromBinMap(manifest.bin);
}

const entryPath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === entryPath) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(1);
  });
}
