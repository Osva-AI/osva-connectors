/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-bigquery.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED_TOOLS = [
  "bigquery.project.get",
  "bigquery.dataset.list",
  "bigquery.dataset.get",
  "bigquery.table.list",
  "bigquery.table.get",
  "bigquery.table.columns.list",
  "bigquery.table.rows.sample",
  "bigquery.table.aggregate",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "bigquery",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-bigquery.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-bigquery"),
    args: [],
    shell: false,
  };
}

function childEnvWithConfig() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_BIGQUERY_PROJECT_ID = "fixture-project";
  env.OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS = "analytics";
  env.OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES =
    '{"analytics":{"events":["event_name"]}}';
  return env;
}

function childEnvMissingProject() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_BIGQUERY_PROJECT_ID;
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
  const main = await import("@osva-ai/connector-bigquery");
  if (typeof main.createBigqueryConnector !== "function") {
    throw new Error("Missing createBigqueryConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-bigquery",
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
    name: "package-acceptance-bigquery",
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

async function testMissingProjectRejected() {
  const shim = npmBinShim();
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env: childEnvMissingProject(),
    stderr: "pipe",
  });
  const client = new Client({
    name: "package-acceptance-bigquery-missing-project",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
    throw new Error(
      "Expected stdio startup to fail without BigQuery project id.",
    );
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
  const { client, getServerStderr } =
    await connectMcpClient(childEnvWithConfig());
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
      name: "bigquery.dataset.get",
      arguments: { datasetId: "" },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected error for invalid dataset id.");
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
    "@osva-ai/connector-bigquery",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingProjectRejected();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-bigquery-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
