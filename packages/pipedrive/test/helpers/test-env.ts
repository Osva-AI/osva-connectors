import { createPipedriveRestClient } from "../../src/pipedrive-rest-client.js";
import type { PipedriveConfig } from "../../src/schemas.js";
import {
  FAKE_PIPEDRIVE_API_TOKEN,
  type MockPipedriveHttpServer,
} from "../fixtures/mock-pipedrive-http-server.js";

export function createTestPipedriveClient(server: MockPipedriveHttpServer) {
  return createPipedriveRestClient({
    apiBaseUrl: server.apiBaseUrl,
    pinnedOrigin: server.pinnedOrigin,
    apiToken: FAKE_PIPEDRIVE_API_TOKEN,
    requestTimeoutMs: 5_000,
  });
}

export function createTestPipedriveConfig(
  overrides: Partial<PipedriveConfig> = {},
): PipedriveConfig {
  return {
    apiBaseUrl: "http://127.0.0.1/api/v2",
    pinnedOrigin: "http://127.0.0.1",
    apiToken: FAKE_PIPEDRIVE_API_TOKEN,
    allowTestApiHost: true,
    stageUpdatesEnabled: false,
    hostWritesApproved: false,
    includePii: false,
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}
