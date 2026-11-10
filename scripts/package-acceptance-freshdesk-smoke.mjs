/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-freshdesk.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED_TOOLS = [
  "freshdesk.ticket.list",
  "freshdesk.ticket.get",
  "freshdesk.ticket.search",
  "freshdesk.ticket.conversation.list",
  "freshdesk.contact.list",
  "freshdesk.contact.get",
  "freshdesk.ticket.note.add",
  "freshdesk.ticket.status.set",
];

const INSTALL_DIR = process.cwd();

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-freshdesk.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-freshdesk"),
    args: [],
    shell: false,
  };
}

function childEnvMinimal() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_FRESHDESK_DOMAIN = "acme";
  env.OSVA_CONNECTOR_FRESHDESK_API_KEY = "freshdesk_acceptance_fixture";
  env.OSVA_CONNECTOR_FRESHDESK_ALLOW_TEST_API_HOST = "true";
  env.OSVA_CONNECTOR_FRESHDESK_API_BASE_URL = "http://127.0.0.1:1/api/v2";
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
    name: "package-acceptance-freshdesk",
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
    console.log("package-acceptance-freshdesk-smoke: tools/list OK");
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
