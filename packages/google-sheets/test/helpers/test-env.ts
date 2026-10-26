import {
  createSheetsRestClient,
  createStaticBearerTokenProvider,
} from "../../src/index.js";
import {
  FAKE_SHEETS_ACCESS_TOKEN,
  type MockSheetsHttpServer,
} from "../fixtures/mock-sheets-http-server.js";
import type { GoogleSheetsConfig } from "../../src/schemas.js";

export function createTestSheetsClient(server: MockSheetsHttpServer) {
  const tokenProvider = createStaticBearerTokenProvider(
    FAKE_SHEETS_ACCESS_TOKEN,
  );
  return createSheetsRestClient({
    tokenProvider,
    requestTimeoutMs: 5_000,
    sheetsApiHost: server.sheetsApiOrigin,
  });
}

export function createTestSheetsConfig(
  overrides: Partial<GoogleSheetsConfig> = {},
): GoogleSheetsConfig {
  return {
    requestTimeoutMs: 5_000,
    writeEnabled: false,
    ...overrides,
  };
}

export { FAKE_SHEETS_ACCESS_TOKEN };
