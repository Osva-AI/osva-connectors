/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-salesforce.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import path from "node:path";

const EXPECTED_TOOLS = [
  "salesforce.account.list",
  "salesforce.account.get",
  "salesforce.contact.list",
  "salesforce.contact.get",
  "salesforce.opportunity.list",
  "salesforce.opportunity.get",
  "salesforce.opportunity.stage.list",
  "salesforce.opportunity.stage.set",
  "salesforce.task.create",
];

const INSTALL_DIR = process.cwd();

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-salesforce.cmd"),
      args: [],
      shell: false,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-salesforce"),
    args: [],
    shell: false,
  };
}

function childEnvMinimal() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_SALESFORCE_INSTANCE_URL = "http://127.0.0.1:1";
  env.OSVA_CONNECTOR_SALESFORCE_ACCESS_TOKEN = "salesforce_acceptance_fixture";
  env.OSVA_CONNECTOR_SALESFORCE_ALLOW_TEST_API_HOST = "true";
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
    name: "package-acceptance-salesforce",
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
    console.log("package-acceptance-salesforce-smoke: tools/list OK");
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
