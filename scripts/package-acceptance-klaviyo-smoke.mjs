/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-klaviyo.
 * Run with cwd = acceptance install directory (node_modules present).
 * Does not call production Klaviyo APIs (tools/list + local validation only).
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const FAKE_API_KEY = "pk_fixture_klaviyo_acceptance_smoke_key_0123456789";

const EXPECTED_TOOLS = [
  "klaviyo.account.get",
  "klaviyo.campaign.list",
  "klaviyo.campaign.get",
  "klaviyo.flow.list",
  "klaviyo.flow.get",
  "klaviyo.metric.list",
  "klaviyo.metric.get",
  "klaviyo.event.list",
  "klaviyo.report.campaign",
  "klaviyo.report.flow",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "klaviyo",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-klaviyo.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-klaviyo"),
    args: [],
    shell: false,
  };
}

function childEnvWithKey() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY = FAKE_API_KEY;
  return env;
}

function childEnvMissingKey() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY;
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
  if (manifest.version !== "1.1.0-rc.2") {
    throw new Error(
      `Unexpected @osva-ai/connector-sdk version: ${manifest.version}`,
    );
  }
}

async function testExportResolution() {
  const main = await import("@osva-ai/connector-klaviyo");
  if (typeof main.createKlaviyoConnector !== "function") {
    throw new Error("Missing createKlaviyoConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-klaviyo",
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
    name: "package-acceptance-klaviyo",
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

async function testMissingCredentials() {
  const shim = npmBinShim();
  let serverStderr = "";
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env: childEnvMissingKey(),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
  });
  const client = new Client({
    name: "package-acceptance-klaviyo-missing-creds",
    version: "1.0.0",
  });
  let connectFailed = false;
  try {
    await client.connect(transport);
    await client.close();
  } catch {
    connectFailed = true;
  }
  if (!connectFailed && !serverStderr.toLowerCase().includes("api key")) {
    throw new Error(
      "Expected stdio startup to fail without OSVA_CONNECTOR_KLAVIYO_PRIVATE_API_KEY.",
    );
  }
}

async function testMcpDiscoveryAndSchemas() {
  const { client, getServerStderr } = await connectMcpClient(childEnvWithKey());
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
      name: "klaviyo.report.campaign",
      arguments: {
        statistics: ["not_allowlisted"],
        timeframeKey: "last_30_days",
        conversionMetricId: "RESQ6t",
      },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected INVALID_INPUT for unknown report statistic.");
    }

    const stdoutLeak = JSON.stringify(listed);
    if (stdoutLeak.includes(FAKE_API_KEY)) {
      throw new Error("API key leaked in tools/list payload.");
    }
  } finally {
    try {
      await client.close();
    } catch (error) {
      const detail = getServerStderr();
      throw new Error(
        `MCP close failed: ${error instanceof Error ? error.message : error}\nserver stderr: ${detail}`,
      );
    }
  }
}

async function main() {
  const connectorDir = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-klaviyo",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingCredentials();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-klaviyo-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
