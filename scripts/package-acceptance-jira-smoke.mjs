/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-jira.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const FAKE_SITE_URL = "https://fixture-example.atlassian.net";
const FAKE_EMAIL = "fixture@example.com";
const FAKE_API_TOKEN = "jira_fixture_api_token_0123456789";

const EXPECTED_TOOLS = [
  "jira.project.list",
  "jira.project.get",
  "jira.issue.search",
  "jira.issue.get",
  "jira.issue.transitions.list",
  "jira.issue.create",
  "jira.issue.update",
  "jira.issue.comment.create",
  "jira.issue.transition",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "jira",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-jira.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-jira"),
    args: [],
    shell: false,
  };
}

function childEnvWithCredentials() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_JIRA_SITE_URL = FAKE_SITE_URL;
  env.OSVA_CONNECTOR_JIRA_EMAIL = FAKE_EMAIL;
  env.OSVA_CONNECTOR_JIRA_API_TOKEN = FAKE_API_TOKEN;
  delete env.OSVA_CONNECTOR_JIRA_CLOUD_ID;
  delete env.OSVA_CONNECTOR_JIRA_ACCESS_TOKEN;
  return env;
}

function childEnvMissingCredentials() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_JIRA_SITE_URL;
  delete env.OSVA_CONNECTOR_JIRA_CLOUD_ID;
  delete env.OSVA_CONNECTOR_JIRA_EMAIL;
  delete env.OSVA_CONNECTOR_JIRA_API_TOKEN;
  delete env.OSVA_CONNECTOR_JIRA_ACCESS_TOKEN;
  return env;
}

async function assertNotLinkedToSourceCheckout(packageDir) {
  const resolved = await fs.realpath(packageDir);
  if (
    resolved.replace(/\\/g, "/").includes(REPO_ROOT_MARKER.replace(/\\/g, "/"))
  ) {
    throw new Error(
      `Installed package resolves to source checkout: ${resolved}`,
    );
  }
}

async function assertSdkFromRegistry(installDir) {
  const sdkPkg = path.join(
    installDir,
    "node_modules",
    "@osva-ai/connector-sdk",
    "package.json",
  );
  const raw = await fs.readFile(sdkPkg, "utf8");
  const manifest = JSON.parse(raw);
  if (manifest.version !== "1.1.4") {
    throw new Error(
      `Unexpected @osva-ai/connector-sdk version: ${manifest.version}`,
    );
  }
}

async function testExportResolution() {
  const main = await import("@osva-ai/connector-jira");
  if (typeof main.createJiraConnector !== "function") {
    throw new Error("Missing createJiraConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-jira",
    "dist",
    "stdio.js",
  );
  await fs.access(stdioEntry);
}

async function connectMcpClient(env) {
  const shim = npmBinShim();
  let serverStderr = "";
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env,
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
  });
  const client = new Client({
    name: "package-acceptance-jira",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
  } catch (error) {
    throw new Error(
      `MCP connect failed: ${error instanceof Error ? error.message : error}\nserver stderr: ${serverStderr}`,
    );
  }
  return { client, getServerStderr: () => serverStderr };
}

async function testMissingCredentialsRejected() {
  const shim = npmBinShim();
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env: childEnvMissingCredentials(),
    stderr: "pipe",
  });
  const client = new Client({
    name: "package-acceptance-jira-missing-creds",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
    throw new Error("Expected stdio startup to fail without Jira credentials.");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Expected stdio startup")
    ) {
      throw error;
    }
  } finally {
    try {
      await client.close();
    } catch {
      // expected
    }
  }
}

async function testMcpDiscoveryAndSchemas() {
  const { client, getServerStderr } = await connectMcpClient(
    childEnvWithCredentials(),
  );
  try {
    const listed = await client.listTools({});
    const names = listed.tools.map((t) => t.name);
    for (const expected of EXPECTED_TOOLS) {
      if (!names.includes(expected)) {
        throw new Error(`Missing tool ${expected} in tools/list.`);
      }
    }
    if (names.length !== EXPECTED_TOOLS.length) {
      throw new Error(
        `Expected exactly ${EXPECTED_TOOLS.length} tools, got ${names.length}.`,
      );
    }

    const invalid = await client.callTool({
      name: "jira.issue.get",
      arguments: { issueKey: "" },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected error for invalid issueKey.");
    }
  } finally {
    try {
      await client.close();
    } catch (error) {
      throw new Error(
        `MCP close failed: ${error instanceof Error ? error.message : error}\nserver stderr: ${getServerStderr()}`,
      );
    }
  }
}

async function main() {
  const connectorDir = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-jira",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingCredentialsRejected();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-jira-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
