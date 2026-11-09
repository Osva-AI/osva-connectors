import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { createSnowflakeConnector } from "../src/connector.js";
import { FakeSnowflakeProviderClient } from "./helpers/fake-provider-client.js";
import { defaultTestSnowflakeConfig } from "./helpers/test-env.js";

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const connector = createSnowflakeConnector({
    client: new FakeSnowflakeProviderClient(),
    config: defaultTestSnowflakeConfig(),
  });
  const tool = connector.tools.find((entry) => entry.name === name);
  if (tool === undefined) {
    throw new Error(`missing tool ${name}`);
  }
  return tool.handler(args, { signal: new AbortController().signal });
}

describe("authorization (snowflake)", () => {
  it("rejects schema outside allowlist", async () => {
    await expect(
      callTool("snowflake.table.list", { schema: "SECRET" }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("rejects table outside allowlist", async () => {
    await expect(
      callTool("snowflake.table.get", { schema: "APP", table: "SECRETS" }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("rejects disallowed column on sample", async () => {
    await expect(
      callTool("snowflake.table.rows.sample", {
        schema: "APP",
        table: "USERS",
        columns: ["PASSWORD"],
      }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });
});
