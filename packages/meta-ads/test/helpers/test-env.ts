import { createMetaGraphClient } from "../../src/meta-graph-client.js";
import {
  FAKE_META_ADS_ACCESS_TOKEN,
  type MockMetaAdsHttpServer,
} from "../fixtures/mock-meta-ads-http-server.js";

export function createTestMetaGraphClient(
  server: MockMetaAdsHttpServer,
  options?: {
    appSecret?: string;
    requestTimeoutMs?: number;
  },
) {
  return createMetaGraphClient({
    accessToken: FAKE_META_ADS_ACCESS_TOKEN,
    requestTimeoutMs: options?.requestTimeoutMs ?? 5_000,
    apiHost: server.apiOrigin,
    apiVersion: "v26.0",
    ...(options?.appSecret !== undefined
      ? { appSecret: options.appSecret }
      : {}),
  });
}
