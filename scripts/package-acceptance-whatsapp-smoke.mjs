/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-whatsapp.
 * Run with cwd = acceptance install directory (node_modules present).
 * Does not call production WhatsApp APIs (tools/list + local validation only).
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const FAKE_ACCESS_TOKEN =
  "EAA_fixture_whatsapp_acceptance_smoke_token_0123456789";
const FAKE_WABA_ID = "102290129340398";
const FAKE_PHONE_NUMBER_ID = "109876543210";

const EXPECTED_TOOLS = [
  "whatsapp.businessAccount.get",
  "whatsapp.phoneNumber.list",
  "whatsapp.phoneNumber.get",
  "whatsapp.businessProfile.get",
  "whatsapp.template.list",
  "whatsapp.template.get",
  "whatsapp.analytics.get",
  "whatsapp.template.send",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "whatsapp",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-whatsapp.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-whatsapp"),
    args: [],
    shell: false,
  };
}

function childEnvWithCredentials() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_WHATSAPP_ACCESS_TOKEN = FAKE_ACCESS_TOKEN;
  env.OSVA_CONNECTOR_WHATSAPP_WABA_ID = FAKE_WABA_ID;
  env.OSVA_CONNECTOR_WHATSAPP_PHONE_NUMBER_ID = FAKE_PHONE_NUMBER_ID;
  env.OSVA_CONNECTOR_WHATSAPP_SEND_ENABLED = "false";
  return env;
}

function childEnvMissingCredentials() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_WHATSAPP_ACCESS_TOKEN;
  delete env.OSVA_CONNECTOR_WHATSAPP_WABA_ID;
  delete env.OSVA_CONNECTOR_WHATSAPP_PHONE_NUMBER_ID;
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
  const main = await import("@osva-ai/connector-whatsapp");
  if (typeof main.createWhatsAppConnector !== "function") {
    throw new Error("Missing createWhatsAppConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-whatsapp",
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
    name: "package-acceptance-whatsapp",
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
    env: childEnvMissingCredentials(),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
  });
  const client = new Client({
    name: "package-acceptance-whatsapp-missing-creds",
    version: "1.0.0",
  });
  let connectFailed = false;
  try {
    await client.connect(transport);
    await client.close();
  } catch {
    connectFailed = true;
  }
  if (!connectFailed && !serverStderr.toLowerCase().includes("access token")) {
    throw new Error(
      "Expected stdio startup to fail without WhatsApp credentials.",
    );
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
      name: "whatsapp.analytics.get",
      arguments: {
        startDate: "2025-01-01",
        endDate: "2025-01-02",
        templateIds: ["123"],
        metricTypes: ["NOT_A_METRIC"],
      },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected INVALID_INPUT for unknown analytics metric.");
    }

    const sendDisabled = await client.callTool({
      name: "whatsapp.template.send",
      arguments: {
        recipient: "15551234567",
        templateName: "order_update",
        languageCode: "en_US",
      },
    });
    if (sendDisabled.isError !== true) {
      throw new Error("Expected send to fail when SEND_ENABLED is false.");
    }

    const stdoutLeak = JSON.stringify(listed);
    if (stdoutLeak.includes(FAKE_ACCESS_TOKEN)) {
      throw new Error("Access token leaked in tools/list payload.");
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
    "@osva-ai/connector-whatsapp",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingCredentials();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-whatsapp-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
