import { createFreshdeskRestClient } from "../../src/freshdesk-rest-client.js";
import type { FreshdeskConfig } from "../../src/schemas.js";
import {
  FAKE_FRESHDESK_API_KEY,
  type MockFreshdeskHttpServer,
} from "../fixtures/mock-freshdesk-http-server.js";

export function createTestFreshdeskClient(server: MockFreshdeskHttpServer) {
  return createFreshdeskRestClient({
    apiBaseUrl: server.apiBaseUrl,
    pinnedOrigin: server.pinnedOrigin,
    apiKey: FAKE_FRESHDESK_API_KEY,
    requestTimeoutMs: 5_000,
  });
}

export function createTestFreshdeskConfig(
  overrides: Partial<FreshdeskConfig> = {},
): FreshdeskConfig {
  return {
    apiBaseUrl: "http://127.0.0.1/api/v2",
    pinnedOrigin: "http://127.0.0.1",
    apiKey: FAKE_FRESHDESK_API_KEY,
    allowTestApiHost: true,
    notesEnabled: false,
    statusEnabled: false,
    hostWritesApproved: false,
    includePii: false,
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}
