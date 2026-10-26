import {
  createDriveRestClient,
  createStaticBearerTokenProvider,
} from "../../src/index.js";
import {
  FAKE_DRIVE_ACCESS_TOKEN,
  type MockDriveHttpServer,
} from "../fixtures/mock-drive-http-server.js";

export function createTestDriveClient(server: MockDriveHttpServer) {
  const tokenProvider = createStaticBearerTokenProvider(
    FAKE_DRIVE_ACCESS_TOKEN,
  );
  return createDriveRestClient({
    tokenProvider,
    requestTimeoutMs: 5_000,
    driveApiHost: server.driveApiOrigin,
  });
}

export { FAKE_DRIVE_ACCESS_TOKEN };
