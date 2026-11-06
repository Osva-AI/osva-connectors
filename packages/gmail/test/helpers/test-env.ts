import {
  createGmailRestClient,
  createStaticBearerTokenProvider,
} from "../../src/index.js";
import {
  FAKE_GMAIL_ACCESS_TOKEN,
  type MockGmailHttpServer,
} from "../fixtures/mock-gmail-http-server.js";

export function createTestGmailClient(server: MockGmailHttpServer) {
  const tokenProvider = createStaticBearerTokenProvider(
    FAKE_GMAIL_ACCESS_TOKEN,
  );
  return createGmailRestClient({
    tokenProvider,
    requestTimeoutMs: 5_000,
    gmailApiHost: server.gmailApiOrigin,
  });
}

export { FAKE_GMAIL_ACCESS_TOKEN };
