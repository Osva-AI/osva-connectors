/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-supabase.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED_TOOLS = [
  "supabase.project.get",
  "supabase.schema.list",
  "supabase.table.list",
  "supabase.table.get",
  "supabase.table.columns.list",
  "supabase.table.rows.list",
  "supabase.table.row.get",
  "supabase.table.rows.count",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "supabase",
  "src",
);

function makeAnonJwt() {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: "supabase", role: "anon" }),
  ).toString("base64url");
  return `${header}.${payload}.fixture_signature`;
}

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-supabase.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-supabase"),
    args: [],
    shell: false,
  };
}

function childEnvWithConfig() {
  const env = { ...process.env };
  const jwt = makeAnonJwt();
  env.OSVA_CONNECTOR_SUPABASE_PROJECT_URL = "https://fixture.supabase.co";
  env.OSVA_CONNECTOR_SUPABASE_PUBLISHABLE_KEY = jwt;
  env.OSVA_CONNECTOR_SUPABASE_USER_ACCESS_TOKEN = jwt;
  env.OSVA_CONNECTOR_SUPABASE_ALLOWED_TABLES = JSON.stringify({
    public: { users: { columns: ["id"], lookupColumn: "id" } },
  });
  return env;
}

function childEnvMissingConfig() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_SUPABASE_PROJECT_URL;
  delete env.OSVA_CONNECTOR_SUPABASE_PUBLISHABLE_KEY;
  delete env.OSVA_CONNECTOR_SUPABASE_USER_ACCESS_TOKEN;
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
  const main = await import("@osva-ai/connector-supabase");
  if (typeof main.createSupabaseConnector !== "function") {
    throw new Error("Missing createSupabaseConnector export.");
  }
  const stdioEntry = path.join(
    INSTALL_DIR,
    "node_modules",
    "@osva-ai/connector-supabase",
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
    name: "package-acceptance-supabase",
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

async function testMissingConfigRejected() {
  const shim = npmBinShim();
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env: childEnvMissingConfig(),
    stderr: "pipe",
  });
  const client = new Client({
    name: "package-acceptance-supabase-missing-config",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
    throw new Error("Expected stdio startup to fail without Supabase config.");
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
      name: "supabase.table.get",
      arguments: { schema: "public", table: "" },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected error for invalid table name.");
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
    "@osva-ai/connector-supabase",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingConfigRejected();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-supabase-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
