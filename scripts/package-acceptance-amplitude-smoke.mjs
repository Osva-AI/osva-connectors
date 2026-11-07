/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-amplitude.
 * Run with cwd = acceptance install directory (node_modules present).
 * Does not call production Amplitude APIs (tools/list + local validation only).
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const FAKE_API_KEY = "amplitude_fixture_acceptance_smoke_api_key";
const FAKE_SECRET_KEY = "amplitude_fixture_acceptance_smoke_secret";

const EXPECTED_TOOLS = [
  "amplitude.event.list",
  "amplitude.event.segmentation",
  "amplitude.funnel.run",
  "amplitude.retention.run",
  "amplitude.user.active",
  "amplitude.chart.get",
  "amplitude.session.average",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "amplitude",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-amplitude.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-amplitude"),
    args: [],
    shell: false,
  };
}

function childEnvWithKeys() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_AMPLITUDE_API_KEY = FAKE_API_KEY;
  env.OSVA_CONNECTOR_AMPLITUDE_SECRET_KEY = FAKE_SECRET_KEY;
  return env;
}

function childEnvMissingKeys() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_AMPLITUDE_API_KEY;
  delete env.OSVA_CONNECTOR_AMPLITUDE_SECRET_KEY;
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
  const main = await import("@osva-ai/connector-amplitude");
  if (typeof main.createAmplitudeConnector !== "function") {
    throw new Error("Missing createAmplitudeConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-amplitude",
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
    name: "package-acceptance-amplitude",
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
    env: childEnvMissingKeys(),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
  });
  const client = new Client({
    name: "package-acceptance-amplitude-missing-creds",
    version: "1.0.0",
  });
  let connectFailed = false;
  try {
    await client.connect(transport);
    await client.close();
  } catch {
    connectFailed = true;
  }
  if (
    !connectFailed &&
    !serverStderr.toLowerCase().includes("api key") &&
    !serverStderr.toLowerCase().includes("secret")
  ) {
    throw new Error(
      "Expected stdio startup to fail without Amplitude API/secret keys.",
    );
  }
}

async function testMcpDiscoveryAndSchemas() {
  const { client, getServerStderr } =
    await connectMcpClient(childEnvWithKeys());
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
      name: "amplitude.event.segmentation",
      arguments: {
        start: "20240101",
        end: "20240601",
        event: { event_type: "Purchase" },
      },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected INVALID_INPUT for >90-day lookback.");
    }

    const stdoutLeak = JSON.stringify(listed);
    if (
      stdoutLeak.includes(FAKE_API_KEY) ||
      stdoutLeak.includes(FAKE_SECRET_KEY)
    ) {
      throw new Error("Credentials leaked in tools/list payload.");
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
    "@osva-ai/connector-amplitude",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingCredentials();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-amplitude-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
