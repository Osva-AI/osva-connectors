/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-zoho-crm.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import path from "node:path";

const EXPECTED_TOOLS = [
  "zoho.lead.list",
  "zoho.lead.get",
  "zoho.account.list",
  "zoho.account.get",
  "zoho.contact.list",
  "zoho.contact.get",
  "zoho.deal.list",
  "zoho.deal.get",
  "zoho.deal.stage.list",
  "zoho.deal.stage.set",
  "zoho.deal.note.add",
];

const INSTALL_DIR = process.cwd();

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-zoho-crm.cmd"),
      args: [],
      shell: false,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-zoho-crm"),
    args: [],
    shell: false,
  };
}

function childEnvMinimal() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_ZOHO_CRM_ACCESS_TOKEN = "zoho_acceptance_fixture";
  env.OSVA_CONNECTOR_ZOHO_CRM_REGION = "us";
  env.OSVA_CONNECTOR_ZOHO_CRM_ALLOW_TEST_API_HOST = "true";
  env.OSVA_CONNECTOR_ZOHO_CRM_API_BASE_URL = "http://127.0.0.1:1/crm/v8";
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
    name: "package-acceptance-zoho-crm",
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
    console.log("package-acceptance-zoho-crm-smoke: tools/list OK");
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
