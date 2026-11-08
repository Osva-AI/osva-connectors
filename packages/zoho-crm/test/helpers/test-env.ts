import { createZohoRestClient } from "../../src/zoho-rest-client.js";
import type { ZohoConfig } from "../../src/schemas.js";
import {
  FAKE_ZOHO_ACCESS_TOKEN,
  type MockZohoHttpServer,
} from "../fixtures/mock-zoho-http-server.js";

export function createTestZohoClient(server: MockZohoHttpServer) {
  return createZohoRestClient({
    apiBaseUrl: server.apiBaseUrl,
    pinnedOrigin: server.pinnedOrigin,
    accessToken: FAKE_ZOHO_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
  });
}

export function createTestZohoConfig(
  overrides: Partial<ZohoConfig> = {},
): ZohoConfig {
  return {
    apiBaseUrl: "http://127.0.0.1/crm/v8",
    pinnedOrigin: "http://127.0.0.1",
    accessToken: FAKE_ZOHO_ACCESS_TOKEN,
    allowTestApiHost: true,
    notesEnabled: false,
    stageUpdatesEnabled: false,
    hostWritesApproved: false,
    includePii: false,
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}
