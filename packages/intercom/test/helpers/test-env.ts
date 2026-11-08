import { createIntercomRestClient } from "../../src/intercom-rest-client.js";
import type { IntercomConfig } from "../../src/schemas.js";
import {
  FAKE_INTERCOM_ACCESS_TOKEN,
  type MockIntercomHttpServer,
} from "../fixtures/mock-intercom-http-server.js";

export function createTestIntercomClient(server: MockIntercomHttpServer) {
  return createIntercomRestClient({
    apiBaseUrl: server.apiBaseUrl,
    pinnedOrigin: server.pinnedOrigin,
    accessToken: FAKE_INTERCOM_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
  });
}

export function createTestIntercomConfig(
  overrides: Partial<IntercomConfig> = {},
): IntercomConfig {
  return {
    apiBaseUrl: "http://127.0.0.1",
    pinnedOrigin: "http://127.0.0.1",
    accessToken: FAKE_INTERCOM_ACCESS_TOKEN,
    adminId: "admin_fixture",
    allowTestApiHost: true,
    notesEnabled: false,
    statusEnabled: false,
    hostWritesApproved: false,
    includePii: false,
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}
