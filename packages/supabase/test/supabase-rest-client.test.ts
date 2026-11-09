import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { createSupabaseRestClient } from "../src/supabase-rest-client.js";
import { makeSupabaseJwt } from "./helpers/jwt-fixture.js";
import { startMockSupabaseHttpServer } from "./fixtures/mock-supabase-http-server.js";

describe("createSupabaseRestClient", () => {
  let server:
    Awaited<ReturnType<typeof startMockSupabaseHttpServer>> | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("pins origin and loads OpenAPI", async () => {
    server = await startMockSupabaseHttpServer();
    const anon = makeSupabaseJwt("anon");
    const client = createSupabaseRestClient({
      restBaseUrl: server.restBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      publishableKey: anon,
      userAccessToken: anon,
      requestTimeoutMs: 5_000,
    });
    const catalog = await client.getOpenApiCatalog();
    expect(catalog.tables.some((t) => t.name === "users")).toBe(true);
  });

  it("rejects cross-origin fetch URLs", async () => {
    server = await startMockSupabaseHttpServer();
    const anon = makeSupabaseJwt("anon");
    const client = createSupabaseRestClient({
      restBaseUrl: server.restBaseUrl,
      pinnedOrigin: "http://evil.test",
      publishableKey: anon,
      userAccessToken: anon,
      requestTimeoutMs: 5_000,
    });
    await expect(client.getOpenApiCatalog()).rejects.toThrow(ConnectorSdkError);
  });

  it("uses explicit select columns for row reads", async () => {
    server = await startMockSupabaseHttpServer();
    const anon = makeSupabaseJwt("anon");
    const client = createSupabaseRestClient({
      restBaseUrl: server.restBaseUrl,
      pinnedOrigin: server.pinnedOrigin,
      publishableKey: anon,
      userAccessToken: anon,
      requestTimeoutMs: 5_000,
    });
    const result = await client.selectRows({
      schema: "public",
      table: "users",
      columns: ["id", "email"],
      limit: 10,
      offset: 0,
    });
    expect(result.rows.length).toBeGreaterThan(0);
  });
});
