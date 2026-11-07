/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-linear.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const FAKE_API_KEY = "lin_api_fixture_linear_acceptance_smoke_key_0123456789";

const EXPECTED_TOOLS = [
  "linear.viewer.get",
  "linear.team.list",
  "linear.issue.list",
  "linear.issue.get",
  "linear.issue.search",
  "linear.project.list",
  "linear.project.get",
  "linear.issue.create",
  "linear.issue.update",
  "linear.comment.create",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "linear",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-linear.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-linear"),
    args: [],
    shell: false,
  };
}

function childEnvWithKey() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_LINEAR_API_KEY = FAKE_API_KEY;
  delete env.OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN;
  return env;
}

function childEnvMissingKey() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_LINEAR_API_KEY;
  delete env.OSVA_CONNECTOR_LINEAR_ACCESS_TOKEN;
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
  const main = await import("@osva-ai/connector-linear");
  if (typeof main.createLinearConnector !== "function") {
    throw new Error("Missing createLinearConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-linear",
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
    name: "package-acceptance-linear",
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
    env: childEnvMissingKey(),
    stderr: "pipe",
  });
  const client = new Client({
    name: "package-acceptance-linear-missing-creds",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
    throw new Error(
      "Expected stdio startup to fail without Linear credentials.",
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
      name: "linear.issue.get",
      arguments: { issueId: "" },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected error for invalid issueId.");
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
    "@osva-ai/connector-linear",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingCredentialsRejected();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-linear-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
