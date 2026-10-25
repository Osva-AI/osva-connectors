/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-slack.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const FAKE_TOKEN = "xoxb-osva_acceptance_fake_0000000000000000";

const EXPECTED_TOOLS = [
  "slack.auth.test",
  "slack.channel.list",
  "slack.channel.info",
  "slack.message.history",
  "slack.message.thread",
  "slack.message.post",
  "slack.message.reply",
];

const INSTALL_DIR = process.cwd();
const REPO_ROOT_MARKER = path.join(
  "osva-connectors",
  "packages",
  "slack",
  "src",
);

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-slack.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-slack"),
    args: [],
    shell: false,
  };
}

function childEnvWithoutSlackConfig() {
  const env = { ...process.env };
  delete env.OSVA_CONNECTOR_SLACK_BOT_TOKEN;
  delete env.OSVA_CONNECTOR_SLACK_TIMEOUT_MS;
  delete env.OSVA_CONNECTOR_SLACK_ALLOWED_CHANNELS;
  delete env.OSVA_CONNECTOR_SLACK_WRITE_ENABLED;
  return env;
}

function childEnvWithFakeSlackConfig() {
  const env = childEnvWithoutSlackConfig();
  env.OSVA_CONNECTOR_SLACK_BOT_TOKEN = FAKE_TOKEN;
  return env;
}

function spawnWithDeadline(command, args, options, deadlineMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
    }, deadlineMs);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
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
  const main = await import("@osva-ai/connector-slack");
  if (typeof main.createSlackConnector !== "function") {
    throw new Error("Missing createSlackConnector export.");
  }
}

async function testMissingConfigStartup() {
  const shim = npmBinShim();
  const result = await spawnWithDeadline(
    shim.command,
    shim.args,
    { env: childEnvWithoutSlackConfig(), shell: shim.shell },
    10_000,
  );
  if (result.code === 0) {
    throw new Error("Expected non-zero exit when Slack config is missing.");
  }
  if (result.stdout.trim().length > 0) {
    throw new Error(
      `stdout must stay clean without config; got: ${result.stdout.slice(0, 200)}`,
    );
  }
  const combined = `${result.stdout}\n${result.stderr}`;
  if (/xoxb-[a-zA-Z0-9-]{20,}/.test(combined)) {
    throw new Error(
      "Token-like secret leaked in missing-config startup output.",
    );
  }
}

async function connectMcpClient() {
  const shim = npmBinShim();
  let serverStderr = "";
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env: childEnvWithFakeSlackConfig(),
    stderr: "pipe",
  });
  transport.stderr?.on("data", (chunk) => {
    serverStderr += String(chunk);
  });
  const client = new Client({
    name: "package-acceptance-slack",
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
      if (tool.name.startsWith("slack.")) {
        const schema = tool.inputSchema;
        if (schema?.type !== "object") {
          throw new Error(`Tool ${tool.name} missing object inputSchema.`);
        }
      }
    }

    const writeBlocked = await client.callTool({
      name: "slack.message.post",
      arguments: { channelId: "C0123456789", text: "hello" },
    });
    if (writeBlocked.isError !== true) {
      throw new Error("Expected write-disabled error for slack.message.post.");
    }

    const invalid = await client.callTool({
      name: "slack.channel.info",
      arguments: { channelId: "not-a-channel" },
    });
    if (invalid.isError !== true) {
      throw new Error("Expected INVALID_INPUT for malformed channel id.");
    }
    const serialized = JSON.stringify(invalid);
    if (serialized.includes(FAKE_TOKEN)) {
      throw new Error("Fake token leaked in MCP error payload.");
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
    "@osva-ai",
    "connector-slack",
  );
  await assertNotLinkedToSourceCheckout(connectorDir);
  await assertSdkFromRegistry(INSTALL_DIR);
  await testExportResolution();
  await testMissingConfigStartup();
  await testMcpDiscoveryAndSchemas();
  console.log("package-acceptance-slack-smoke: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
