import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { createBigcommerceRestClient } from "../src/bigcommerce-rest-client.js";

describe("BigCommerce REST client security", () => {
  it("does not follow redirects", async () => {
    const client = createBigcommerceRestClient({
      apiHost: "https://api.bigcommerce.com",
      storeHash: "abc123",
      accessToken: "token",
      requestTimeoutMs: 5_000,
      fetchImpl: (async () =>
        new Response("", {
          status: 301,
          headers: { Location: "https://evil.example" },
        })) as typeof fetch,
    });
    await expect(client.listProducts({ page: 1, limit: 1 })).rejects.toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects malformed JSON on success responses", async () => {
    const client = createBigcommerceRestClient({
      apiHost: "https://api.bigcommerce.com",
      storeHash: "abc123",
      accessToken: "token",
      requestTimeoutMs: 5_000,
      fetchImpl: (async () =>
        new Response("{not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
    });
    await expect(client.getProduct(1)).rejects.toThrow(ConnectorSdkError);
  });

  it("does not retry PUT on 503", async () => {
    let calls = 0;
    const client = createBigcommerceRestClient({
      apiHost: "https://api.bigcommerce.com",
      storeHash: "abc123",
      accessToken: "token",
      requestTimeoutMs: 5_000,
      fetchImpl: (async (_url, init) => {
        calls += 1;
        if (init?.method === "PUT") {
          return new Response(JSON.stringify({ title: "err" }), {
            status: 503,
          });
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }) as typeof fetch,
    });
    await expect(client.updateProduct(1, { price: 1 })).rejects.toMatchObject({
      kind: "http",
      status: 503,
    });
    expect(calls).toBe(1);
  });
});
