import { afterEach, describe, expect, it } from "vitest";

import {
  startMockQdrantHttpServer,
  type MockQdrantHttpServer,
} from "./fixtures/mock-qdrant-http-server.js";
import { createTestQdrantClient } from "./helpers/test-env.js";

describe("createQdrantRestClient", () => {
  let server: MockQdrantHttpServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("lists collections with api-key header", async () => {
    server = await startMockQdrantHttpServer();
    const client = createTestQdrantClient(server);
    const raw = await client.listCollections();
    expect(server.getLastApiKey()).toBeDefined();
    expect(server.getLastPathname()).toBe("/collections");
    expect(raw).toMatchObject({
      result: { collections: expect.any(Array) },
    });
  });

  it("queries points on scroll path", async () => {
    server = await startMockQdrantHttpServer();
    const client = createTestQdrantClient(server);
    await client.scrollPoints({
      collectionName: "docs",
      limit: 5,
    });
    expect(server.getLastPathname()).toBe("/collections/docs/points/scroll");
    expect(server.getLastMethod()).toBe("POST");
  });
});
