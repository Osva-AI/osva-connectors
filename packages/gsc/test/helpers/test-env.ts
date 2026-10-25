import {
  createGscRestClient,
  createStaticBearerTokenProvider,
} from "../../src/index.js";
import {
  FAKE_GSC_ACCESS_TOKEN,
  type MockGscHttpServer,
} from "../fixtures/mock-gsc-http-server.js";

export function createTestGscClient(server: MockGscHttpServer) {
  const tokenProvider = createStaticBearerTokenProvider(FAKE_GSC_ACCESS_TOKEN);
  return createGscRestClient({
    tokenProvider,
    urlInspectionTokenProvider: tokenProvider,
    requestTimeoutMs: 5_000,
    webmastersApiHost: server.webmastersApiOrigin,
    searchConsoleApiHost: server.searchConsoleApiOrigin,
  });
}

export { FAKE_GSC_ACCESS_TOKEN };
