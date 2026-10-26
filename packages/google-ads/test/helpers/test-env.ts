import {
  createGoogleAdsRestClient,
  createStaticBearerTokenProvider,
} from "../../src/index.js";
import {
  FAKE_GOOGLE_ADS_ACCESS_TOKEN,
  type MockGoogleAdsHttpServer,
} from "../fixtures/mock-google-ads-http-server.js";

export function createTestGoogleAdsClient(
  server: MockGoogleAdsHttpServer,
  options?: {
    loginCustomerId?: string;
    developerToken?: string;
    requestTimeoutMs?: number;
  },
) {
  return createGoogleAdsRestClient({
    tokenProvider: createStaticBearerTokenProvider(
      FAKE_GOOGLE_ADS_ACCESS_TOKEN,
    ),
    requestTimeoutMs: options?.requestTimeoutMs ?? 5_000,
    apiHost: server.apiOrigin,
    ...(options?.loginCustomerId !== undefined
      ? { loginCustomerId: options.loginCustomerId }
      : {}),
    ...(options?.developerToken !== undefined
      ? { developerToken: options.developerToken }
      : {}),
  });
}
