import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapFirecrawlError } from "../src/map-firecrawl-error.js";

describe("mapFirecrawlError", () => {
  it("maps 401 HTTP errors", () => {
    const mapped = mapFirecrawlError({
      kind: "http",
      status: 401,
      firecrawlError: "Unauthorized",
    });
    expect(mapped).toBeInstanceOf(ConnectorSdkError);
    expect(mapped.code).toBe("UNAUTHORIZED");
  });

  it("redacts API keys from error messages", () => {
    const secret = "fc_super_secret_key";
    const mapped = mapFirecrawlError(new Error(`failed with ${secret}`), {
      apiKey: secret,
    });
    expect(mapped.message).not.toContain(secret);
  });
});
