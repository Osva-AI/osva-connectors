import { createZendeskRestClient } from "../../src/zendesk-rest-client.js";
import type { ZendeskConfig } from "../../src/schemas.js";
import {
  FAKE_ZENDESK_API_TOKEN,
  FAKE_ZENDESK_EMAIL,
  type MockZendeskHttpServer,
} from "../fixtures/mock-zendesk-http-server.js";

export function createTestZendeskClient(server: MockZendeskHttpServer) {
  return createZendeskRestClient({
    apiBaseUrl: server.apiBaseUrl,
    pinnedOrigin: server.pinnedOrigin,
    email: FAKE_ZENDESK_EMAIL,
    apiToken: FAKE_ZENDESK_API_TOKEN,
    requestTimeoutMs: 5_000,
  });
}

export function createTestZendeskConfig(
  overrides: Partial<ZendeskConfig> = {},
): ZendeskConfig {
  return {
    apiBaseUrl: "http://127.0.0.1/api/v2",
    pinnedOrigin: "http://127.0.0.1",
    email: FAKE_ZENDESK_EMAIL,
    apiToken: FAKE_ZENDESK_API_TOKEN,
    allowTestApiHost: true,
    notesEnabled: false,
    statusEnabled: false,
    hostWritesApproved: false,
    includePii: false,
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}

export { FAKE_ZENDESK_API_TOKEN, FAKE_ZENDESK_EMAIL };
