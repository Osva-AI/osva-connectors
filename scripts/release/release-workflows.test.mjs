import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  expectedAcceptanceCommand,
  expectedWorkflowFileName,
  loadConnectorPackages,
  resolveReleaseChecklistFile,
} from "./load-connector-packages.mjs";
import { parseGitHubActionsWorkflow } from "./parse-github-actions-yaml.mjs";

const ROOT = path.dirname(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
);
const WORKFLOWS_DIR = path.join(ROOT, ".github", "workflows");
const DOCS_DIR = path.join(ROOT, "docs");

function stepRun(step) {
  return typeof step.run === "string" ? step.run : "";
}

function inputDefault(input) {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  return input.default;
}

async function loadReleaseFixtures() {
  const connectors = await loadConnectorPackages(ROOT);
  const docsFiles = await fs.readdir(DOCS_DIR);
  const rootPackage = JSON.parse(
    await fs.readFile(path.join(ROOT, "package.json"), "utf8"),
  );
  const workflows = [];
  for (const connector of connectors) {
    const fileName = expectedWorkflowFileName(connector.directory);
    const filePath = path.join(WORKFLOWS_DIR, fileName);
    const text = await fs.readFile(filePath, "utf8");
    workflows.push({
      connector,
      fileName,
      filePath,
      text,
      parsed: parseGitHubActionsWorkflow(text),
      checklist: resolveReleaseChecklistFile(docsFiles, connector.directory),
    });
  }
  return { connectors, docsFiles, rootPackage, workflows };
}

const fixtures = await loadReleaseFixtures();

test("workspace packages are the source of truth for release workflows", () => {
  assert.equal(fixtures.connectors.length > 0, true);
  const workflowFiles = fixtures.workflows.map((item) => item.fileName);
  assert.equal(new Set(workflowFiles).size, fixtures.connectors.length);
});

test("every connector maps to the expected release workflow file", () => {
  for (const item of fixtures.workflows) {
    assert.equal(
      item.fileName,
      expectedWorkflowFileName(item.connector.directory),
    );
    assert.equal(
      item.parsed.workingDirectory,
      `packages/${item.connector.directory}`,
    );
    assert.match(
      item.text,
      new RegExp(`@osva-ai/connector-${item.connector.directory}`),
    );
    assert.equal(
      inputDefault(item.parsed.inputs.expected_version),
      item.connector.version,
    );
  }
});

test("release workflows are manual, npm-environment, and OIDC-permissioned", () => {
  for (const item of fixtures.workflows) {
    assert.deepEqual(item.parsed.triggerKeys, ["workflow_dispatch"]);
    assert.equal(item.parsed.environment, "npm");
    assert.equal(item.parsed.permissions.contents, "read");
    assert.equal(item.parsed.permissions["id-token"], "write");
    assert.equal(Object.keys(item.parsed.permissions).length, 2);
    assert.equal(item.text.includes("\non:\n  push:"), false);
    assert.equal(item.text.includes("\non:\n  pull_request:"), false);
  }
});

test("default dispatch cannot publish and real upload requires confirmation", () => {
  for (const item of fixtures.workflows) {
    assert.equal(inputDefault(item.parsed.inputs.dry_run), true);
    assert.equal(inputDefault(item.parsed.inputs.confirm_publish), false);
    assert.equal(inputDefault(item.parsed.inputs.use_npm_token), false);

    const publish = item.parsed.steps.find(
      (step) => step.name === "npm publish",
    );
    assert.ok(publish, `${item.fileName} missing npm publish step`);
    assert.equal(
      publish.if,
      "inputs.dry_run == false && inputs.confirm_publish == true",
    );
    assert.match(stepRun(publish), /scripts\/release\/run-npm-publish\.mjs/);

    const refuse = item.parsed.steps.find(
      (step) => step.name === "Refuse publish without confirmation",
    );
    assert.ok(refuse, `${item.fileName} missing confirmation guard`);
    assert.equal(
      refuse.if,
      "inputs.dry_run == false && inputs.confirm_publish != true",
    );
  }
});

test("OIDC is the default auth path and empty NODE_AUTH_TOKEN is not injected", () => {
  for (const item of fixtures.workflows) {
    const configure = item.parsed.steps.find(
      (step) => step.name === "Configure npm authentication for publish",
    );
    assert.ok(configure, `${item.fileName} missing OIDC configure step`);
    assert.match(
      stepRun(configure),
      /scripts\/release\/configure-npm-publish-auth\.mjs/,
    );
    assert.equal(configure.env?.USE_NPM_TOKEN, "${{ inputs.use_npm_token }}");

    const publish = item.parsed.steps.find(
      (step) => step.name === "npm publish",
    );
    assert.equal(
      publish.env?.NODE_AUTH_TOKEN,
      undefined,
      `${item.fileName} must not set NODE_AUTH_TOKEN from secrets directly`,
    );
    assert.equal(publish.env?.USE_NPM_TOKEN, "${{ inputs.use_npm_token }}");
  }
});

test("registry existence checks fail closed instead of swallowing npm view errors", () => {
  for (const item of fixtures.workflows) {
    const check = item.parsed.steps.find(
      (step) => step.name === "Check npm for existing version (publish only)",
    );
    assert.ok(check, `${item.fileName} missing unpublished-version check`);
    assert.equal(
      check.if,
      "inputs.dry_run == false && inputs.confirm_publish == true",
    );
    assert.match(
      stepRun(check),
      /scripts\/release\/check-npm-version-unpublished\.mjs/,
    );
    assert.match(stepRun(check), new RegExp(`"${item.connector.name}"`));
    assert.equal(stepRun(check).includes("2>/dev/null"), false);
  }
});

test("package names, acceptance commands, and checklists match the workspace", () => {
  for (const item of fixtures.workflows) {
    const expectedAcceptance = expectedAcceptanceCommand(
      item.connector.directory,
    );
    const acceptanceStep = item.parsed.steps.find((step) =>
      stepRun(step).includes(expectedAcceptance),
    );
    assert.ok(acceptanceStep, `${item.fileName} missing ${expectedAcceptance}`);
    const scriptName = expectedAcceptance.replace("pnpm ", "");
    assert.equal(
      typeof fixtures.rootPackage.scripts[scriptName],
      "string",
      `root package.json missing script ${scriptName}`,
    );

    const foreignChecklists = item.parsed.headerComments.filter((line) => {
      const match = line.match(/docs\/(RELEASE-CHECKLIST[^.\s]*\.md)/);
      if (!match) {
        return false;
      }
      return `docs/${match[1]}` !== item.checklist;
    });
    assert.deepEqual(
      foreignChecklists,
      [],
      `${item.fileName} has stale checklist comments`,
    );
    assert.match(item.text, new RegExp(item.checklist.replaceAll(".", "\\.")));

    const verify = item.parsed.steps.find((step) =>
      String(step.name ?? "").startsWith("Verify package name"),
    );
    assert.ok(verify, `${item.fileName} missing package identity check`);
    assert.match(stepRun(verify), /CONNECTOR_VERSION/);
    assert.match(
      stepRun(verify),
      new RegExp(`pkg\\.name !== "${item.connector.name}"`),
    );
  }
});

test("production publication is limited to main and uses a compatible npm CLI", () => {
  for (const item of fixtures.workflows) {
    const branch = item.parsed.steps.find(
      (step) => step.name === "Verify branch",
    );
    assert.ok(branch);
    assert.match(stepRun(branch), /refs\/heads\/main/);

    const npmCli = item.parsed.steps.find((step) =>
      String(step.name ?? "").includes("npm CLI 11.5.1"),
    );
    assert.ok(npmCli, `${item.fileName} missing npm 11.5.1+ guard`);
    assert.match(stepRun(npmCli), /npm@11\.5\.1/);

    const setupNode = item.parsed.steps.find(
      (step) =>
        step.uses && String(step.uses).startsWith("actions/setup-node@"),
    );
    assert.ok(setupNode);
    assert.equal(setupNode.with?.["node-version"], "24");

    const dryRun = item.parsed.steps.find(
      (step) => step.name === "npm publish (dry run)",
    );
    assert.ok(dryRun);
    assert.equal(dryRun.if, "inputs.dry_run == true");
    assert.match(stepRun(dryRun), /--provenance=false/);
  }
});

test("non-gmail workflows do not tell operators to use the Gmail checklist", () => {
  for (const item of fixtures.workflows) {
    if (item.connector.directory === "gmail") {
      continue;
    }
    assert.equal(
      item.text.includes("RELEASE-CHECKLIST-GMAIL.md"),
      false,
      `${item.fileName} still references the Gmail checklist`,
    );
  }
});

test("meta-ads workflow does not reuse the Google Ads checklist", () => {
  const meta = fixtures.workflows.find(
    (item) => item.connector.directory === "meta-ads",
  );
  assert.ok(meta);
  assert.equal(meta.text.includes("RELEASE-CHECKLIST-GOOGLE-ADS.md"), false);
  assert.equal(meta.checklist, "docs/RELEASE-CHECKLIST-META-ADS.md");
});
