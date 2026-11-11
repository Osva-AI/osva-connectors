#!/usr/bin/env node
/**
 * B5.6A: Compact summary from published-package-acceptance JSON report.
 *
 * Usage:
 *   node scripts/release/summarize-published-verification.mjs [path-to-report.json]
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CHECK, STATUS } from "./published-package-acceptance-core.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);

export function summarizePublishedReport(report) {
  const byOverall = { PASSED: 0, FAILED: 0, SKIPPED: 0 };
  const checkTotals = {};
  for (const id of Object.values(CHECK)) {
    checkTotals[id] = { PASSED: 0, FAILED: 0, SKIPPED: 0 };
  }

  const failures = [];
  const provenance = { wave: [], legacy: [] };
  const packages = Array.isArray(report?.packages) ? report.packages : [];

  for (const pkg of packages) {
    const overall = typeof pkg.overall === "string" ? pkg.overall : "UNKNOWN";
    byOverall[overall] = (byOverall[overall] ?? 0) + 1;
    for (const check of pkg.checks ?? []) {
      const status =
        typeof check.status === "string" ? check.status : "UNKNOWN";
      const bucket = checkTotals[check.id] ?? {
        PASSED: 0,
        FAILED: 0,
        SKIPPED: 0,
        UNKNOWN: 0,
      };
      bucket[status] = (bucket[status] ?? 0) + 1;
      checkTotals[check.id] = bucket;
      if (status === STATUS.FAILED) {
        failures.push({
          package: `${pkg.name}@${pkg.version}`,
          check: check.id,
          evidence: check.evidence,
        });
      }
      if (check.id === CHECK.PROVENANCE) {
        const row = `${pkg.name}@${pkg.version}: ${status} (${check.evidence})`;
        if (pkg.wave) {
          provenance.wave.push(row);
        } else {
          provenance.legacy.push(row);
        }
      }
    }
  }

  return {
    byOverall,
    checkTotals,
    failures,
    provenance,
    packageCount: packages.length,
    checksSkipped: Number(report?.summary?.checksSkipped ?? 0),
  };
}

async function main() {
  const arg = process.argv[2];
  const reportPath = arg
    ? path.resolve(arg)
    : path.join(
        ROOT,
        "audit-results",
        "published-acceptance",
        "b5-6a-windows-full.json",
      );

  let raw;
  try {
    raw = await fs.readFile(reportPath, "utf8");
  } catch (error) {
    console.error(`Cannot read report: ${reportPath}`);
    throw error;
  }
  const report = JSON.parse(raw);
  const { byOverall, checkTotals, failures, provenance } =
    summarizePublishedReport(report);

  const lines = [
    "# Published verification summary (generated)",
    "",
    `- Source report: \`${path.relative(ROOT, reportPath).replace(/\\/g, "/")}\``,
    `- Generated at (report): ${report.generatedAt ?? "n/a"}`,
    `- Platform: ${report.platform ?? "n/a"}`,
    `- Node: ${report.nodeVersion ?? "n/a"}`,
    `- Concurrency: ${report.concurrency ?? "n/a"}`,
    "",
    "## Package outcomes",
    "",
    `| Overall | Count |`,
    `| --- | ---: |`,
    `| PASSED | ${byOverall.PASSED ?? 0} |`,
    `| FAILED | ${byOverall.FAILED ?? 0} |`,
    `| SKIPPED | ${byOverall.SKIPPED ?? 0} |`,
    "",
    "## Per-check totals",
    "",
    "| Check | PASSED | FAILED | SKIPPED |",
    "| --- | ---: | ---: | ---: |",
  ];

  for (const [id, totals] of Object.entries(checkTotals).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(
      `| ${id} | ${totals.PASSED ?? 0} | ${totals.FAILED ?? 0} | ${totals.SKIPPED ?? 0} |`,
    );
  }

  lines.push(
    "",
    "## Version matrix",
    "",
    "| Package | Version | Overall | Wave |",
  );
  lines.push("| --- | --- | --- | --- |");
  for (const pkg of report.packages ?? []) {
    lines.push(
      `| ${pkg.name} | ${pkg.version} | ${pkg.overall} | ${pkg.wave ? "B5" : "legacy"} |`,
    );
  }

  if (failures.length > 0) {
    lines.push("", "## Failures", "");
    for (const f of failures) {
      lines.push(
        `- **${f.package}** \`${f.check}\`: ${String(f.evidence ?? "").slice(0, 240)}`,
      );
    }
  }

  lines.push(
    "",
    "## Provenance (B5 wave — mandatory)",
    "",
    ...(provenance.wave.length > 0
      ? provenance.wave.map((r) => `- ${r}`)
      : ["- (none in report)"]),
    "",
    "## Provenance (legacy — SKIPPED unless mandated)",
    "",
    ...(provenance.legacy.length > 0
      ? provenance.legacy.slice(0, 5).map((r) => `- ${r}`)
      : ["- (none)"]),
  );
  if (provenance.legacy.length > 5) {
    lines.push(
      `- … and ${provenance.legacy.length - 5} more (see JSON report)`,
    );
  }

  const out = `${lines.join("\n")}\n`;
  console.log(out);
}

const entry = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === entry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
