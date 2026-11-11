import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadConnectorPackages } from "./load-connector-packages.mjs";
import { parseGitHubActionsWorkflow } from "./parse-github-actions-yaml.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);
const WORKFLOW = path.join(
  ROOT,
  ".github",
  "workflows",
  "published-package-acceptance-linux.yml",
);

function stepRun(step) {
  return typeof step.run === "string" ? step.run : "";
}

const text = await fs.readFile(WORKFLOW, "utf8");
const parsed = parseGitHubActionsWorkflow(text);
const job = parsed.doc?.jobs?.published_acceptance ?? {};
const steps = Array.isArray(job.steps) ? job.steps : [];
const connectors = await loadConnectorPackages(ROOT);

test("linux published acceptance is workflow_dispatch only with read-only permissions", () => {
  assert.match(text, /workflow_dispatch/);
  assert.doesNotMatch(text, /^\s*on:\s*\n\s*push:/m);
  assert.doesNotMatch(text, /pull_request:/);
  assert.match(text, /permissions:\s*\n\s*contents: read/m);
  assert.doesNotMatch(text, /id-token:\s*write/);
  assert.doesNotMatch(text, /packages: write/);
  assert.match(text, /timeout-minutes:\s*180/);
});

test("linux workflow uses Node 24 and published-package-acceptance against npm", () => {
  const setup = steps.find(
    (step) => step.uses && String(step.uses).startsWith("actions/setup-node@"),
  );
  assert.ok(setup);
  assert.equal(setup.with?.["node-version"], "24");

  const runStep = steps.find((step) =>
    String(step.name ?? "").includes("Run published package acceptance"),
  );
  assert.ok(runStep);
  assert.match(stepRun(runStep), /published-package-acceptance\.mjs/);
  assert.match(stepRun(runStep), /--all-connectors/);
  assert.doesNotMatch(stepRun(runStep), /pnpm publish/);
  assert.doesNotMatch(stepRun(runStep), /OSVA_LIVE_PROVIDER/);
});

test("linux workflow uploads JSON and MD artifacts even on failure", () => {
  const upload = steps.find((step) =>
    String(step.name ?? "").includes("Upload acceptance reports"),
  );
  assert.ok(upload);
  assert.equal(upload.if, "always()");
  const artifactPath = String(upload.with?.path ?? "");
  assert.match(artifactPath, /json/);
  assert.match(artifactPath, /md/);
});

test("linux workflow targets all 45 workspace connector versions", () => {
  assert.equal(connectors.length, 45);
  assert.match(text, /45 connectors/);
  assert.match(
    stepRun(
      steps.find((step) =>
        String(step.name ?? "").includes("Run published package acceptance"),
      ),
    ),
    /--all-connectors/,
  );
});
