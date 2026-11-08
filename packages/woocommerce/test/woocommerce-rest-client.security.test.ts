import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { createWoocommerceRestClient } from "../src/woocommerce-rest-client.js";

describe("WooCommerce REST client security", () => {
  it("rejects requests whose origin does not match pinned store URL", async () => {
    const client = createWoocommerceRestClient({
      apiBaseUrl: "https://shop.example/wp-json/wc/v3",
      pinnedOrigin: "https://other.example",
      consumerKey: "ck",
      consumerSecret: "cs",
      requestTimeoutMs: 5_000,
      fetchImpl: fetch,
    });
    await expect(client.listProducts({ page: 1, perPage: 1 })).rejects.toThrow(
      ConnectorSdkError,
    );
  });

  it("does not follow redirects", async () => {
    let calls = 0;
    const client = createWoocommerceRestClient({
      apiBaseUrl: "https://shop.example/wp-json/wc/v3",
      pinnedOrigin: "https://shop.example",
      consumerKey: "ck",
      consumerSecret: "cs",
      requestTimeoutMs: 5_000,
      fetchImpl: (async () => {
        calls += 1;
        return new Response("", {
          status: 302,
          headers: { Location: "https://evil.example/steal" },
        });
      }) as typeof fetch,
    });
    await expect(client.listProducts({ page: 1, perPage: 1 })).rejects.toThrow(
      ConnectorSdkError,
    );
    expect(calls).toBe(1);
  });

  it("rejects malformed JSON on success responses", async () => {
    const client = createWoocommerceRestClient({
      apiBaseUrl: "https://shop.example/wp-json/wc/v3",
      pinnedOrigin: "https://shop.example",
      consumerKey: "ck",
      consumerSecret: "cs",
      requestTimeoutMs: 5_000,
      fetchImpl: (async () =>
        new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })) as typeof fetch,
    });
    await expect(client.getProduct(1)).rejects.toThrow(ConnectorSdkError);
  });

  it("does not retry mutations after server errors", async () => {
    let calls = 0;
    const client = createWoocommerceRestClient({
      apiBaseUrl: "https://shop.example/wp-json/wc/v3",
      pinnedOrigin: "https://shop.example",
      consumerKey: "ck",
      consumerSecret: "cs",
      requestTimeoutMs: 5_000,
      fetchImpl: (async (_input, init) => {
        calls += 1;
        if (init?.method === "PUT") {
          return new Response(JSON.stringify({ message: "fail" }), {
            status: 503,
          });
        }
        return new Response("[]", { status: 200 });
      }) as typeof fetch,
    });
    await expect(
      client.updateProduct(1, { regular_price: "9.99" }),
    ).rejects.toMatchObject({ kind: "http", status: 503 });
    expect(calls).toBe(1);
  });
});
