import {
  createGa4RestClient,
  createStaticBearerTokenProvider,
} from "../../src/index.js";
import {
  FAKE_GA4_ACCESS_TOKEN,
  type MockGa4HttpServer,
} from "../fixtures/mock-ga4-http-server.js";

export function createTestGa4Client(server: MockGa4HttpServer) {
  return createGa4RestClient({
    tokenProvider: createStaticBearerTokenProvider(FAKE_GA4_ACCESS_TOKEN),
    requestTimeoutMs: 5_000,
    dataApiHost: server.dataApiOrigin,
    adminApiHost: server.adminApiOrigin,
    accessTokenForRedaction: FAKE_GA4_ACCESS_TOKEN,
  });
}
