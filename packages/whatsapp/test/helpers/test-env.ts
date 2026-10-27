import { createWhatsAppGraphClient } from "../../src/whatsapp-graph-client.js";
import type { WhatsAppConfig } from "../../src/schemas.js";
import {
  FAKE_WHATSAPP_ACCESS_TOKEN,
  MOCK_PHONE_NUMBER_ID,
  MOCK_RECIPIENT,
  MOCK_WABA_ID,
  type MockWhatsAppHttpServer,
} from "../fixtures/mock-whatsapp-http-server.js";

export function createTestWhatsAppConfig(
  overrides?: Partial<WhatsAppConfig>,
): WhatsAppConfig {
  return {
    accessToken: FAKE_WHATSAPP_ACCESS_TOKEN,
    wabaId: MOCK_WABA_ID,
    phoneNumberId: MOCK_PHONE_NUMBER_ID,
    sendEnabled: false,
    requestTimeoutMs: 5_000,
    maxRows: 100,
    allowedRecipients: [MOCK_RECIPIENT],
    ...overrides,
  };
}

export function createTestWhatsAppClient(
  server: MockWhatsAppHttpServer,
  options?: {
    appSecret?: string;
    requestTimeoutMs?: number;
  },
) {
  return createWhatsAppGraphClient({
    accessToken: FAKE_WHATSAPP_ACCESS_TOKEN,
    requestTimeoutMs: options?.requestTimeoutMs ?? 5_000,
    apiHost: server.apiOrigin,
    apiVersion: "v26.0",
    ...(options?.appSecret !== undefined
      ? { appSecret: options.appSecret }
      : {}),
  });
}
