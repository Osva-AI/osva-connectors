/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-hubspot.
 * Run with cwd = acceptance install directory (node_modules present).
 * Does not call production HubSpot APIs (tools/list + local validation only).
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const FAKE_ACCESS_TOKEN =
  "pat-na1-fixture_hubspot_acceptance_smoke_key_0123456789";

const EXPECTED_TOOLS = [
  "hubspot.contact.list",
  "hubspot.contact.get",
  "hubspot.company.list",
  "hubspot.company.get",
  "hubspot.deal.list",
  "hubspot.deal.get",
  "hubspot.crm.search",
  "hubspot.pipeline.list",
  "hubspot.owner.list",
  "hubspot.association.list",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "hubspot",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-hubspot.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-hubspot"),
    args: [],
    shell: false,
  };
}

function childEnvWithKey() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN = FAKE_ACCESS_TOKEN;
  return env;
}

function childEnvMissingKey() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN;
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
  const main = await import("@osva-ai/connector-hubspot");
  if (typeof main.createHubspotConnector !== "function") {
    throw new Error("Missing createHubspotConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-hubspot",
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
    name: "package-acceptance-hubspot",
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
    name: "package-acceptance-hubspot-missing-creds",
    version: "1.0.0",
  });
  let connectFailed = false;
  try {
    await client.connect(transport);
    await client.close();
  } catch {
    connectFailed = true;
  }
  if (!connectFailed && !serverStderr.toLowerCase().includes("token")) {
    throw new Error(
      "Expected stdio startup to fail without OSVA_CONNECTOR_HUBSPOT_ACCESS_TOKEN.",
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
      name: "hubspot.crm.search",
      arguments: {
        objectType: "contacts",
        filterGroups: [
          {
            filters: [
              {
                propertyName: "email",
                operator: "EQ",
                value: "test@example.com",
              },
            ],
          },
        ],
      },
    });
    if (invalid.isError !== true) {
      throw new Error(
        "Expected INVALID_INPUT for non-allowlisted search property.",
      );
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
    "@osva-ai/connector-hubspot",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingCredentials();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-hubspot-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
