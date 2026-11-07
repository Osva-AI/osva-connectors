import { createPineconeRestClient } from "../../src/pinecone-rest-client.js";
import {
  FAKE_PINECONE_API_KEY,
  type MockPineconeHttpServer,
} from "../fixtures/mock-pinecone-http-server.js";

export function createTestPineconeClient(server: MockPineconeHttpServer) {
  return createPineconeRestClient({
    apiKey: FAKE_PINECONE_API_KEY,
    requestTimeoutMs: 5_000,
    controlPlaneHost: server.controlPlaneOrigin,
    allowLoopbackDataHosts: true,
  });
}

export function defaultTestPineconeConfig() {
  return {
    apiKey: FAKE_PINECONE_API_KEY,
    writeEnabled: true,
    hostWritesApproved: true,
    requestTimeoutMs: 5_000,
  } as const;
}

export { FAKE_PINECONE_API_KEY };
