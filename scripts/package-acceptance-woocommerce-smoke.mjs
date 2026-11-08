/**
 * MCP smoke tests for an isolated npm install of @osva-ai/connector-woocommerce.
 */
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs/promises";
import path from "node:path";

const EXPECTED_TOOLS = [
  "woocommerce.product.list",
  "woocommerce.product.get",
  "woocommerce.product.variation.list",
  "woocommerce.product.variation.get",
  "woocommerce.category.list",
  "woocommerce.order.list",
  "woocommerce.order.get",
  "woocommerce.order.note.list",
  "woocommerce.product.update",
  "woocommerce.order.status.update",
];

const INSTALL_DIR = process.cwd();

function npmBinShim() {
  const binDir = path.join(INSTALL_DIR, "node_modules", ".bin");
  if (process.platform === "win32") {
    return {
      command: path.join(binDir, "osva-connector-woocommerce.cmd"),
      args: [],
      shell: true,
    };
  }
  return {
    command: path.join(binDir, "osva-connector-woocommerce"),
    args: [],
    shell: false,
  };
}

function childEnvMinimal() {
  const env = { ...process.env };
  env.OSVA_CONNECTOR_WOOCOMMERCE_STORE_URL =
    "https://example.test/wp-json/wc/v3";
  env.OSVA_CONNECTOR_WOOCOMMERCE_CONSUMER_KEY = "ck_acceptance_fixture";
  env.OSVA_CONNECTOR_WOOCOMMERCE_CONSUMER_SECRET = "cs_acceptance_fixture";
  env.OSVA_CONNECTOR_WOOCOMMERCE_WRITE_ENABLED = "false";
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
    name: "package-acceptance-woocommerce",
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
    console.log("package-acceptance-woocommerce-smoke: tools/list OK");
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
