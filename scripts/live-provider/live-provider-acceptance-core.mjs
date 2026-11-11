import fs from "node:fs/promises";
import path from "node:path";

import prettier from "prettier";

import { loadConnectorPackages } from "../release/load-connector-packages.mjs";
import { spawnWithWallClockDeadline } from "../release/published-package-acceptance-core.mjs";
import {
  areDestructiveApproved,
  shouldRunMockFixtures,
} from "./live-provider-gates.mjs";
import {
  ACCEPTANCE_STATUS,
  CONNECTOR_LIVE_META,
  HIGH_PRIORITY_GROUPS,
  INFRASTRUCTURE_DIRECTORIES,
  metaForDirectory,
  PILOT_DIRECTORIES,
  RISK,
} from "./live-provider-matrix-meta.mjs";
import { redactReportObject } from "./live-provider-redact.mjs";
import { runAwsS3Scenarios } from "./scenarios/aws-s3.mjs";
import { runAzureBlobScenarios } from "./scenarios/azure-blob.mjs";
import { runBigqueryScenarios } from "./scenarios/bigquery.mjs";
import { runGcsScenarios } from "./scenarios/gcs.mjs";
import { runGithubScenarios } from "./scenarios/github.mjs";
import { runPineconeScenarios } from "./scenarios/pinecone.mjs";
import { runPostgresScenarios } from "./scenarios/postgres.mjs";
import { runQdrantScenarios } from "./scenarios/qdrant.mjs";
import { runSnowflakeScenarios } from "./scenarios/snowflake.mjs";

const INFRASTRUCTURE_RUNNERS = Object.freeze({
  "aws-s3": runAwsS3Scenarios,
  gcs: runGcsScenarios,
  "azure-blob": runAzureBlobScenarios,
  bigquery: runBigqueryScenarios,
  snowflake: runSnowflakeScenarios,
  postgres: runPostgresScenarios,
  qdrant: runQdrantScenarios,
  pinecone: runPineconeScenarios,
});

const PILOT_RUNNERS = Object.freeze({
  ...INFRASTRUCTURE_RUNNERS,
  github: runGithubScenarios,
});

const STATUS_RANK = Object.freeze({
  [ACCEPTANCE_STATUS.FAILED]: 5,
  [ACCEPTANCE_STATUS.BLOCKED]: 4,
  [ACCEPTANCE_STATUS.NOT_RUN]: 3,
  [ACCEPTANCE_STATUS.SKIPPED]: 2,
  [ACCEPTANCE_STATUS.PASSED]: 1,
});

export { ACCEPTANCE_STATUS } from "./live-provider-matrix-meta.mjs";

export async function buildLiveProviderMatrix(repoRoot) {
  const connectors = await loadConnectorPackages(repoRoot);
  const rows = connectors.map((connector) => {
    const meta = metaForDirectory(connector.directory);
    return {
      directory: connector.directory,
      name: connector.name,
      version: connector.version,
      provider: meta.provider,
      authMethod: meta.authMethod,
      priorityGroup: meta.priorityGroup,
      riskLevel: meta.riskLevel,
      requiredEnv: meta.requiredEnv ?? [],
      policyEnv: meta.policyEnv ?? [],
      credentialSignals: meta.credentialSignals ?? [],
      liveHarnessEnv: meta.liveHarnessEnv ?? [],
      readOnlyOps: meta.readOnlyOps ?? [],
      mutationOps: meta.mutationOps ?? [],
      destructiveOps: meta.destructiveOps ?? [],
      sandboxNotes: meta.sandboxNotes ?? "",
      mockAcceptanceCoverage: meta.mockSmoke ?? "none",
      mockVitest: meta.mockVitest ?? [],
      liveProviderCoverage: INFRASTRUCTURE_RUNNERS[connector.directory]
        ? "B5.5B infrastructure scenarios"
        : connector.directory === "github"
          ? "B5.5A pilot scenarios"
          : "matrix only (deferred)",
      securityBoundaries: meta.securityBoundaries ?? [],
      rateLimitNotes: meta.rateLimitNotes ?? "",
      cleanup: meta.cleanup ?? "",
      costNotes: meta.costNotes ?? "",
      pilot: Boolean(meta.pilot || INFRASTRUCTURE_RUNNERS[connector.directory]),
      acceptanceStatus: ACCEPTANCE_STATUS.NOT_RUN,
    };
  });

  rows.sort((a, b) => {
    const ga = HIGH_PRIORITY_GROUPS.indexOf(a.priorityGroup);
    const gb = HIGH_PRIORITY_GROUPS.indexOf(b.priorityGroup);
    const pa = ga === -1 ? 99 : ga;
    const pb = gb === -1 ? 99 : gb;
    if (pa !== pb) {
      return pa - pb;
    }
    const ra =
      a.riskLevel === RISK.CRITICAL
        ? 0
        : a.riskLevel === RISK.HIGH
          ? 1
          : a.riskLevel === RISK.MEDIUM
            ? 2
            : 3;
    const rb =
      b.riskLevel === RISK.CRITICAL
        ? 0
        : b.riskLevel === RISK.HIGH
          ? 1
          : b.riskLevel === RISK.MEDIUM
            ? 2
            : 3;
    if (ra !== rb) {
      return ra - rb;
    }
    return a.directory.localeCompare(b.directory);
  });

  return rows;
}

export function summarizeScenarioStatuses(scenarios) {
  let worst = ACCEPTANCE_STATUS.PASSED;
  for (const scenario of scenarios) {
    if ((STATUS_RANK[scenario.status] ?? 0) > (STATUS_RANK[worst] ?? 0)) {
      worst = scenario.status;
    }
  }
  const failed = scenarios.filter((s) => s.status === ACCEPTANCE_STATUS.FAILED);
  const requiredFailed = failed.filter((s) =>
    String(s.id).startsWith("preflight"),
  );
  return {
    acceptanceStatus: worst,
    failed: failed.length,
    requiredFailed: requiredFailed.length,
  };
}

export async function runConnectorLiveAcceptance(directory, options) {
  const {
    repoRoot,
    timeoutMs = 120_000,
    includeMock = false,
    spawnImpl = spawnWithWallClockDeadline,
  } = options;
  const meta = metaForDirectory(directory);
  const runner = PILOT_RUNNERS[directory];
  if (!runner) {
    return {
      directory,
      pilot: false,
      acceptanceStatus: ACCEPTANCE_STATUS.NOT_RUN,
      scenarios: [
        {
          id: "deferred",
          status: ACCEPTANCE_STATUS.NOT_RUN,
          evidence: "No live-provider runner — matrix entry only",
        },
      ],
    };
  }

  const scenarios = await runner({
    repoRoot,
    meta,
    timeoutMs,
    includeMock,
    spawnImpl,
  });
  const summary = summarizeScenarioStatuses(scenarios);
  return {
    directory,
    pilot: Boolean(INFRASTRUCTURE_RUNNERS[directory] || directory === "github"),
    acceptanceStatus: summary.acceptanceStatus,
    scenarios,
    summary,
  };
}

export async function runLiveProviderMatrix(options) {
  const {
    repoRoot,
    directories = [],
    pilotOnly = false,
    infrastructureOnly = false,
    includeMock = false,
    timeoutMs = Number(process.env.OSVA_LIVE_PROVIDER_TIMEOUT_MS ?? "120000"),
    delayMs = Number(process.env.OSVA_LIVE_PROVIDER_DELAY_MS ?? "250"),
    spawnImpl = spawnWithWallClockDeadline,
  } = options;

  const matrix = await buildLiveProviderMatrix(repoRoot);
  let targets = matrix.map((row) => row.directory);
  if (infrastructureOnly) {
    targets = INFRASTRUCTURE_DIRECTORIES.filter((d) => targets.includes(d));
  } else if (pilotOnly) {
    targets = PILOT_DIRECTORIES.filter((d) => targets.includes(d));
  } else if (directories.length > 0) {
    targets = directories.filter(
      (d) => CONNECTOR_LIVE_META[d] || matrix.find((m) => m.directory === d),
    );
  }

  const packages = [];
  for (let i = 0; i < targets.length; i += 1) {
    const directory = targets[i];
    const result = await runConnectorLiveAcceptance(directory, {
      repoRoot,
      timeoutMs,
      includeMock: shouldRunMockFixtures(includeMock),
      spawnImpl,
    });
    packages.push(result);
    if (delayMs > 0 && i < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const updatedMatrix = matrix.map((row) => {
    const ran = packages.find((p) => p.directory === row.directory);
    if (ran) {
      return {
        ...row,
        acceptanceStatus: ran.acceptanceStatus,
        scenarios: ran.scenarios,
      };
    }
    return row;
  });

  const summary = {
    connectorsTotal: matrix.length,
    connectorsExecuted: packages.length,
    pilotExecuted: packages.filter((p) => p.pilot).length,
    failed: packages.filter(
      (p) => p.acceptanceStatus === ACCEPTANCE_STATUS.FAILED,
    ).length,
    blocked: packages.filter(
      (p) => p.acceptanceStatus === ACCEPTANCE_STATUS.BLOCKED,
    ).length,
    notRun: packages.filter(
      (p) => p.acceptanceStatus === ACCEPTANCE_STATUS.NOT_RUN,
    ).length,
    destructiveApproved: areDestructiveApproved(),
  };

  return {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    mode: {
      liveExecution: process.env.OSVA_LIVE_PROVIDER_EXECUTE === "1",
      mutationsApproved:
        process.env.OSVA_LIVE_PROVIDER_MUTATIONS_APPROVED === "1",
      mockFixtures: shouldRunMockFixtures(includeMock),
    },
    summary,
    matrix: updatedMatrix,
    packages,
  };
}

export function renderLiveProviderMarkdown(report) {
  const lines = [
    "# Live provider acceptance report (B5.5B)",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Platform: ${report.platform}`,
    `- Node: ${report.nodeVersion}`,
    `- Live execution: ${report.mode.liveExecution}`,
    `- Mutations approved: ${report.mode.mutationsApproved}`,
    `- Mock fixtures: ${report.mode.mockFixtures}`,
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Connectors in matrix | ${report.summary.connectorsTotal} |`,
    `| Executed this run | ${report.summary.connectorsExecuted} |`,
    `| Failed overall | ${report.summary.failed} |`,
    `| Blocked overall | ${report.summary.blocked} |`,
    `| Not run (executed slice) | ${report.summary.notRun} |`,
    "",
    "## Pilot / executed packages",
    "",
  ];

  for (const pkg of report.packages) {
    lines.push(`### ${pkg.directory}`, "");
    lines.push(`Overall: **${pkg.acceptanceStatus}**`, "");
    lines.push("| Scenario | Status | Evidence |", "| --- | --- | --- |");
    for (const scenario of pkg.scenarios ?? []) {
      lines.push(
        `| ${scenario.id} | ${scenario.status} | ${String(scenario.evidence ?? "").replace(/\|/g, "\\|")} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Full matrix (acceptance status)", "");
  lines.push(
    "| Package | Version | Risk | Group | Live coverage | Status |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const row of report.matrix) {
    lines.push(
      `| ${row.name} | ${row.version} | ${row.riskLevel} | ${row.priorityGroup} | ${row.liveProviderCoverage} | ${row.acceptanceStatus} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function renderLiveProviderMatrixDoc(matrix) {
  const lines = [
    "# OSVA Connectors — live provider acceptance matrix (B5.5B)",
    "",
    "Statuses: `PASSED`, `FAILED`, `SKIPPED`, `BLOCKED`, `NOT_RUN`.",
    "Unexecuted live tests remain `NOT_RUN` — never `PASSED`.",
    "",
    "| Package | Version | Provider | Auth | Risk | Group | Required env | Pilot | Coverage | Status |",
    "| --- | --- | --- | --- | --- | --- | --- | :---: | --- | --- |",
  ];
  for (const row of matrix) {
    const env = (row.requiredEnv ?? []).join(", ") || "(see README)";
    lines.push(
      `| ${row.name} | ${row.version} | ${row.provider} | ${row.authMethod} | ${row.riskLevel} | ${row.priorityGroup} | ${env} | ${row.pilot ? "yes" : ""} | ${row.liveProviderCoverage ?? ""} | ${row.acceptanceStatus} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Apply repo Prettier rules so generated matrix matches `prettier --check`.
 * Prettier reformats markdown table column padding (printWidth: 80).
 */
export async function formatLiveProviderMatrixDoc(markdown, matrixFilePath) {
  return prettier.format(markdown, { filepath: matrixFilePath });
}

export async function writeLiveProviderReports(report, paths) {
  const safe = redactReportObject(report);
  if (paths.json) {
    await fs.mkdir(path.dirname(paths.json), { recursive: true });
    await fs.writeFile(
      paths.json,
      `${JSON.stringify(safe, null, 2)}\n`,
      "utf8",
    );
  }
  if (paths.markdown) {
    await fs.mkdir(path.dirname(paths.markdown), { recursive: true });
    await fs.writeFile(
      paths.markdown,
      `${renderLiveProviderMarkdown(safe)}\n`,
      "utf8",
    );
  }
  if (paths.matrixDoc) {
    await fs.mkdir(path.dirname(paths.matrixDoc), { recursive: true });
    const raw = `${renderLiveProviderMatrixDoc(safe.matrix)}\n`;
    const formatted = await formatLiveProviderMatrixDoc(raw, paths.matrixDoc);
    await fs.writeFile(paths.matrixDoc, formatted, "utf8");
  }
}

export function evaluateExitCode(report, { failOnBlocked = false } = {}) {
  const failed = report.packages.some(
    (p) => p.acceptanceStatus === ACCEPTANCE_STATUS.FAILED,
  );
  if (failed) {
    return 1;
  }
  if (failOnBlocked) {
    const blocked = report.packages.some(
      (p) => p.acceptanceStatus === ACCEPTANCE_STATUS.BLOCKED,
    );
    if (blocked) {
      return 1;
    }
  }
  const preflightFailed = report.packages.some((p) =>
    (p.scenarios ?? []).some(
      (s) =>
        String(s.id).startsWith("preflight") &&
        s.status === ACCEPTANCE_STATUS.FAILED,
    ),
  );
  return preflightFailed ? 1 : 0;
}
