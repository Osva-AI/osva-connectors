import { createSalesforceRestClient } from "../../src/salesforce-rest-client.js";
import type { SalesforceConfig } from "../../src/schemas.js";
import {
  API_VERSION,
  FAKE_SALESFORCE_ACCESS_TOKEN,
  type MockSalesforceHttpServer,
} from "../fixtures/mock-salesforce-http-server.js";

export function createTestSalesforceClient(server: MockSalesforceHttpServer) {
  return createSalesforceRestClient({
    apiDataBaseUrl: server.apiDataBaseUrl,
    pinnedOrigin: server.pinnedOrigin,
    accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
  });
}

export function createTestSalesforceConfig(
  overrides: Partial<SalesforceConfig> = {},
): SalesforceConfig {
  return {
    instanceUrl: "http://127.0.0.1",
    pinnedOrigin: "http://127.0.0.1",
    apiDataBaseUrl: `http://127.0.0.1/services/data/${API_VERSION}`,
    apiVersion: API_VERSION,
    accessToken: FAKE_SALESFORCE_ACCESS_TOKEN,
    allowTestApiHost: true,
    stageUpdatesEnabled: false,
    tasksEnabled: false,
    hostWritesApproved: false,
    includePii: false,
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}
