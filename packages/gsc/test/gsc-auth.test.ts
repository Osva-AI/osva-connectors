import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { createStaticBearerTokenProvider } from "../src/gsc-auth.js";

describe("gsc-auth", () => {
  it("returns bearer header for static token", async () => {
    const provider = createStaticBearerTokenProvider("token-abc");
    await expect(provider.getAuthorizationHeader()).resolves.toBe(
      "Bearer token-abc",
    );
  });

  it("rejects empty static token", async () => {
    const provider = createStaticBearerTokenProvider("  ");
    await expect(provider.getAuthorizationHeader()).rejects.toBeInstanceOf(
      ConnectorSdkError,
    );
  });

  it("propagates abort during static token fetch", async () => {
    const provider = createStaticBearerTokenProvider("token-abc");
    const controller = new AbortController();
    controller.abort();
    await expect(
      provider.getAuthorizationHeader({ signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
