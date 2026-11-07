import {
  createOneDriveRestClient,
  createStaticBearerTokenProvider,
} from "../../src/index.js";
import {
  FAKE_ONEDRIVE_ACCESS_TOKEN,
  type MockGraphHttpServer,
} from "../fixtures/mock-graph-http-server.js";
import type { OneDriveConfig } from "../../src/schemas.js";

export function createTestOneDriveClient(server: MockGraphHttpServer) {
  const tokenProvider = createStaticBearerTokenProvider(
    FAKE_ONEDRIVE_ACCESS_TOKEN,
  );
  return createOneDriveRestClient({
    tokenProvider,
    requestTimeoutMs: 5_000,
    graphApiHost: server.graphApiOrigin,
  });
}

export function createTestOneDriveConfig(
  overrides: Partial<OneDriveConfig> = {},
): OneDriveConfig {
  return {
    accessToken: FAKE_ONEDRIVE_ACCESS_TOKEN,
    requestTimeoutMs: 5_000,
    maxContentBytes: 262_144,
    smallUploadMaxBytes: 262_144,
    writeEnabled: false,
    hostWritesApproved: false,
    ...overrides,
  };
}

export { FAKE_ONEDRIVE_ACCESS_TOKEN };
