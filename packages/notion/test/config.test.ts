import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadNotionConfig } from "../src/config.js";
import {
  NOTION_ACCESS_TOKEN_ENV,
  NOTION_API_VERSION_ENV,
} from "../src/constants.js";

describe("loadNotionConfig", () => {
  it("requires integration token", () => {
    expect(() => loadNotionConfig({})).toThrow(ConnectorSdkError);
  });

  it("rejects unsupported API versions", () => {
    expect(() =>
      loadNotionConfig({
        [NOTION_ACCESS_TOKEN_ENV]: "secret_test",
        [NOTION_API_VERSION_ENV]: "2022-06-28",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("defaults to read-only mutation flags", () => {
    const config = loadNotionConfig({
      [NOTION_ACCESS_TOKEN_ENV]: "secret_test",
    });
    expect(config.writeEnabled).toBe(false);
    expect(config.hostWritesApproved).toBe(false);
    expect(config.apiVersion).toBe("2026-03-11");
  });
});
