import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { parseGraphListResponse } from "../src/meta-graph-client.js";
import {
  startMockMetaAdsHttpServer,
  type MockMetaAdsHttpServer,
} from "./fixtures/mock-meta-ads-http-server.js";
import { createTestMetaGraphClient } from "./helpers/test-env.js";

describe("Meta Graph client", () => {
  let server: MockMetaAdsHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("sends Authorization header and optional appsecret_proof", async () => {
    server = await startMockMetaAdsHttpServer();
    const client = createTestMetaGraphClient(server, {
      appSecret: "fixture-app-secret",
    });
    await client.listEdge({
      path: "me/adaccounts",
      fields: ["account_id"],
      limit: 5,
    });
    expect(server.getLastAuthorization()).toMatch(/^Bearer /);
    expect(server.getLastAppSecretProof()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects oversized responses", async () => {
    server = await startMockMetaAdsHttpServer({ mode: "oversized" });
    const client = createTestMetaGraphClient(server);
    await expect(
      client.listEdge({
        path: "me/adaccounts",
        fields: ["account_id"],
        limit: 5,
      }),
    ).rejects.toBeInstanceOf(ConnectorSdkError);
  });

  it("retries once on rate limit", async () => {
    server = await startMockMetaAdsHttpServer({ mode: "rate_limit_once" });
    const client = createTestMetaGraphClient(server);
    await client.listEdge({
      path: "me/adaccounts",
      fields: ["account_id"],
      limit: 5,
    });
    expect(server.getRequestCount()).toBeGreaterThan(1);
  });

  it("flags malicious paging links during parse", () => {
    expect(() =>
      parseGraphListResponse(
        {
          data: [],
          paging: {
            next: "https://evil.example.com/v26.0/me/adaccounts",
          },
        },
        "https://graph.facebook.com",
      ),
    ).toThrow(ConnectorSdkError);
  });
});
