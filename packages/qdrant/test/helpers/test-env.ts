import { createQdrantRestClient } from "../../src/qdrant-rest-client.js";
import {
  FAKE_QDRANT_API_KEY,
  type MockQdrantHttpServer,
} from "../fixtures/mock-qdrant-http-server.js";

export function createTestQdrantClient(server: MockQdrantHttpServer) {
  return createQdrantRestClient({
    baseUrl: server.baseUrl,
    apiKey: FAKE_QDRANT_API_KEY,
    requestTimeoutMs: 5_000,
  });
}

export function defaultTestQdrantConfig() {
  return {
    baseUrl: "http://127.0.0.1:6333",
    apiKey: FAKE_QDRANT_API_KEY,
    allowLocalHttp: true,
    writeEnabled: true,
    hostWritesApproved: true,
    requestTimeoutMs: 5_000,
  } as const;
}

export { FAKE_QDRANT_API_KEY };
