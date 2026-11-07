/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-mixpanel.
 * Run with cwd = acceptance install directory (node_modules present).
 * Does not call production Mixpanel APIs (tools/list + local validation only).
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const FAKE_PROJECT_ID = "12345";
const FAKE_USERNAME = "acceptance_mixpanel_user";
const FAKE_SECRET = "acceptance_mixpanel_secret_not_real";

const EXPECTED_TOOLS = [
  "mixpanel.report.get",
  "mixpanel.segmentation.run",
  "mixpanel.funnel.get",
  "mixpanel.retention.run",
  "mixpanel.cohort.list",
  "mixpanel.event.top",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "mixpanel",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-mixpanel.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-mixpanel"),
    args: [],
    shell: false,
  };
}

function childEnvMinimal() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_USERNAME;
  delete env.OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_SECRET;
  delete env.OSVA_CONNECTOR_MIXPANEL_PROJECT_ID;
  delete env.OSVA_CONNECTOR_MIXPANEL_REGION;
  env.OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_USERNAME = FAKE_USERNAME;
  env.OSVA_CONNECTOR_MIXPANEL_SERVICE_ACCOUNT_SECRET = FAKE_SECRET;
  env.OSVA_CONNECTOR_MIXPANEL_PROJECT_ID = FAKE_PROJECT_ID;
  env.OSVA_CONNECTOR_MIXPANEL_REGION = "us";
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
  const resolved = await fs.realpath(path.dirname(sdkPkg));
  if (
    resolved.replace(/\\/g, "/").includes(REPO_ROOT_MARKER.replace(/\\/g, "/"))
  ) {
    throw new Error(`connector-sdk resolves to monorepo source: ${resolved}`);
  }
}

async function testExportResolution() {
  const main = await import("@osva-ai/connector-mixpanel");
  if (typeof main.createMixpanelConnector !== "function") {
    throw new Error("Missing createMixpanelConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-mixpanel",
    "dist",
    "stdio.js",
  );
  await fs.access(stdioEntry);
  const pkg = JSON.parse(
    await fs.readFile(
      path.join(
        INSTALL_DIR,
        "node_modules",
        "@osva-ai/connector-mixpanel",
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
    name: "package-acceptance-mixpanel",
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
      if (tool.name.startsWith("mixpanel.")) {
        const schema = tool.inputSchema;
        if (schema?.type !== "object") {
          throw new Error(`Tool ${tool.name} missing object inputSchema.`);
        }
      }
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
    "@osva-ai/connector-mixpanel",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-mixpanel-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
