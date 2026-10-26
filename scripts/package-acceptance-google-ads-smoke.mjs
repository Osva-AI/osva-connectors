/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-google-ads.
 * Run with cwd = acceptance install directory (node_modules present).
 * Does not call production Google Ads APIs (tools/list + local validation only).
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED_TOOLS = [
  "ads.customer.list",
  "ads.customer.get",
  "ads.campaign.list",
  "ads.campaign.performance",
  "ads.adGroup.performance",
  "ads.keyword.performance",
  "ads.searchTerm.performance",
  "ads.asset.performance",
  "ads.report.query",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "google-ads",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-google-ads.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-google-ads"),
    args: [],
    shell: false,
  };
}

function childEnvMinimal() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  delete env.OSVA_CONNECTOR_GOOGLE_ADS_TIMEOUT_MS;
  delete env.OSVA_CONNECTOR_GOOGLE_ADS_ALLOWED_CUSTOMERS;
  delete env.GOOGLE_APPLICATION_CREDENTIALS;
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
  const resolved = await fs.realpath(path.dirname(sdkPkg));
  if (
    resolved.replace(/\\/g, "/").includes(REPO_ROOT_MARKER.replace(/\\/g, "/"))
  ) {
    throw new Error(`connector-sdk resolves to monorepo source: ${resolved}`);
  }
}

async function testExportResolution() {
  const main = await import("@osva-ai/connector-google-ads");
  if (typeof main.createGoogleAdsConnector !== "function") {
    throw new Error("Missing createGoogleAdsConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-google-ads",
    "dist",
    "stdio.js",
  );
  await fs.access(stdioEntry);
  const pkg = JSON.parse(
    await fs.readFile(
      path.join(
        INSTALL_DIR,
        "node_modules",
        "@osva-ai/connector-google-ads",
        "package.json",
      ),
      "utf8",
    ),
  );
  if (pkg.exports?.["./stdio"]?.import !== "./dist/stdio.js") {
    throw new Error("Unexpected ./stdio export map in installed package.");
  }
}

async function connectMcpClient() {
  const shim = npmBinShim();
  let serverStderr = "";
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env: childEnvMinimal(),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
  });
  const client = new Client({
    name: "package-acceptance-google-ads",
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

async function testMcpDiscoveryAndSchemas() {
  const { client, getServerStderr } = await connectMcpClient();
  try {
    const listed = await client.listTools({});
    const names = listed.tools.map((t) => t.name);
    for (const expected of EXPECTED_TOOLS) {
      if (!names.includes(expected)) {
        throw new Error(`Missing tool ${expected} in tools/list.`);
      }
    }
    if (new Set(names).size !== names.length) {
      throw new Error("Duplicate tool names in tools/list.");
    }
    if (names.length !== EXPECTED_TOOLS.length) {
      throw new Error(
        `Expected exactly ${EXPECTED_TOOLS.length} tools, got ${names.length}: ${names.join(", ")}`,
      );
    }

    for (const tool of listed.tools) {
      if (tool.name.startsWith("ads.")) {
        const schema = tool.inputSchema;
        if (schema?.type !== "object") {
          throw new Error(`Tool ${tool.name} missing object inputSchema.`);
        }
      }
    }

    const invalid = await client.callTool({
      name: "ads.campaign.performance",
      arguments: {
        customerId: "1234567890",
        startDate: "2024-01-01",
        endDate: "2024-01-02",
        currencyCode: "US",
      },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected INVALID_INPUT for malformed currency code.");
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
    "@osva-ai/connector-google-ads",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-google-ads-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
