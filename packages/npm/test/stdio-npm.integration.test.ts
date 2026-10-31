import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
  NPM_DOWNLOADS_TOOL,
  NPM_PACKAGE_METADATA_TOOL,
} from "../src/constants.js";

const PKG_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const STDIO_SCRIPT = path.join(PKG_ROOT, "dist", "stdio.js");

function stdioAvailable(): boolean {
  return fs.existsSync(STDIO_SCRIPT);
}

describe("npm connector stdio integration", () => {
  const clients: Client[] = [];

  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map(async (client) => {
        try {
          await client.close();
        } catch {
          // ignore
        }
      }),
    );
  });

  it("starts stdio MCP and lists canonical tools", async () => {
    if (!stdioAvailable()) {
      throw new Error(
        `Missing ${STDIO_SCRIPT}. Run: pnpm --filter @osva-ai/connector-npm build`,
      );
    }

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [STDIO_SCRIPT],
      env: {
        ...process.env,
        OSVA_CONNECTOR_NPM_TIMEOUT_MS: "10000",
      },
      stderr: "pipe",
    });

    const client = new Client({ name: "stdio-test", version: "1.0.0" });
    clients.push(client);
    await client.connect(transport);

    const listed = await client.listTools({});
    const names = listed.tools.map((tool) => tool.name);
    expect(names).toEqual([NPM_PACKAGE_METADATA_TOOL, NPM_DOWNLOADS_TOOL]);
  });
});
