import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const PACKAGE_JSON = join(
  dirname(fileURLToPath(import.meta.url)),
  "../package.json",
);

const FORBIDDEN_DEPENDENCIES = [
  "@osva/db",
  "@osva/domain",
  "@osva/orchestration",
];

const EXPECTED_TOOLS = [
  "salesforce.account.list",
  "salesforce.account.get",
  "salesforce.contact.list",
  "salesforce.contact.get",
  "salesforce.opportunity.list",
  "salesforce.opportunity.get",
  "salesforce.opportunity.stage.list",
  "salesforce.opportunity.stage.set",
  "salesforce.task.create",
];

describe("connector-salesforce package isolation", () => {
  it("does not depend on internal OSVA monorepo packages", async () => {
    const manifest = JSON.parse(await fs.readFile(PACKAGE_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];

    for (const forbidden of FORBIDDEN_DEPENDENCIES) {
      expect(names).not.toContain(forbidden);
    }

    for (const name of names) {
      if (name.startsWith("@osva/") && !name.startsWith("@osva-ai/")) {
        expect.fail(`Unexpected monorepo dependency: ${name}`);
      }
    }
  });

  it("stdio entry has shebang", () => {
    const stdioPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../src/stdio.ts",
    );
    const head = readFileSync(stdioPath, "utf8").split("\n", 1)[0];
    expect(head).toBe("#!/usr/bin/env node");
  });
});

describe("Salesforce connector architecture", () => {
  it("declares exactly nine tools in connector inventory", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const connectorSource = readFileSync(
      join(root, "..", "src", "connector.ts"),
      "utf8",
    );
    const constantsSource = readFileSync(
      join(root, "..", "src", "constants.ts"),
      "utf8",
    );
    for (const tool of EXPECTED_TOOLS) {
      expect(constantsSource).toMatch(
        new RegExp(`"${tool.replaceAll(".", "\\.")}"`),
      );
    }
    for (const constant of [
      "SALESFORCE_ACCOUNT_LIST_TOOL",
      "SALESFORCE_ACCOUNT_GET_TOOL",
      "SALESFORCE_CONTACT_LIST_TOOL",
      "SALESFORCE_CONTACT_GET_TOOL",
      "SALESFORCE_OPPORTUNITY_LIST_TOOL",
      "SALESFORCE_OPPORTUNITY_GET_TOOL",
      "SALESFORCE_OPPORTUNITY_STAGE_LIST_TOOL",
      "SALESFORCE_OPPORTUNITY_STAGE_SET_TOOL",
      "SALESFORCE_TASK_CREATE_TOOL",
    ]) {
      expect(connectorSource).toContain(`name: ${constant}`);
    }
    expect(connectorSource.match(/defineTool\(/g)?.length).toBe(9);
  });

  it("builds SOQL only in soql-builder", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const connectorSource = readFileSync(
      join(root, "..", "src", "connector.ts"),
      "utf8",
    );
    expect(connectorSource).not.toMatch(/SELECT\s+/i);
    const restSource = readFileSync(
      join(root, "..", "src", "salesforce-rest-client.ts"),
      "utf8",
    );
    expect(restSource).not.toMatch(/SELECT\s+/i);
    const soqlSource = readFileSync(
      join(root, "..", "src", "soql-builder.ts"),
      "utf8",
    );
    expect(soqlSource).toMatch(/SELECT\s+/);
  });

  it("allows only bounded REST verbs on inventory paths", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      join(root, "..", "src", "salesforce-rest-client.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/method:\s*"DELETE"/);
    expect(source).not.toMatch(/method:\s*"PUT"/);
    expect(source).toMatch(/requestJson\(\s*"GET"/);
    expect(source).toMatch(/requestJson\(\s*"PATCH"/);
    expect(source).toMatch(/requestJson\(\s*"POST"/);
    expect(source).toContain("/query");
    expect(source).toContain("/sobjects/");
  });
});
