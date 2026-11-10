/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-intercom.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED_TOOLS = [
  "intercom.conversation.list",
  "intercom.conversation.get",
  "intercom.conversation.search",
  "intercom.contact.list",
  "intercom.contact.get",
  "intercom.contact.search",
  "intercom.admin.list",
  "intercom.conversation.note.add",
  "intercom.conversation.state.set",
];

const INSTALL_DIR = process.cwd();

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-intercom.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-intercom"),
    args: [],
    shell: false,
  };
}

function childEnvMinimal() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_INTERCOM_ACCESS_TOKEN = "intercom_acceptance_fixture";
  env.OSVA_CONNECTOR_INTERCOM_REGION = "us";
  env.OSVA_CONNECTOR_INTERCOM_ADMIN_ID = "admin_fixture";
  env.OSVA_CONNECTOR_INTERCOM_ALLOW_TEST_API_HOST = "true";
  env.OSVA_CONNECTOR_INTERCOM_API_BASE_URL = "https://example.test";
  return env;
}

async function connectMcpClient() {
  const shim = npmBinShim();
  const transport = new StdioClientTransport({
    command: shim.command,
    args: shim.args,
    env: childEnvMinimal(),
    stderr: "pipe",
  });
  const client = new Client({
    name: "package-acceptance-intercom",
    version: "1.0.0",
  });
  await client.connect(transport);
  return { client, transport };
}

async function main() {
  const { client, transport } = await connectMcpClient();
  try {
    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    if (JSON.stringify(names) !== JSON.stringify([...EXPECTED_TOOLS].sort())) {
      throw new Error(`Unexpected tools: ${JSON.stringify(names)}`);
    }
    console.log("package-acceptance-intercom-smoke: tools/list OK");
  } finally {
    await transport.close();
    await client.close();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
