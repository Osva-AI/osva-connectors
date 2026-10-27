import { describe, expect, it } from "vitest";

import { computeAppSecretProof } from "../src/appsecret-proof.js";
import {
  FAKE_WHATSAPP_ACCESS_TOKEN,
  MOCK_WABA_ID,
  startMockWhatsAppHttpServer,
} from "./fixtures/mock-whatsapp-http-server.js";
import { createTestWhatsAppClient } from "./helpers/test-env.js";

describe("WhatsApp Graph client", () => {
  it("sends Authorization bearer and optional appsecret_proof", async () => {
    const server = await startMockWhatsAppHttpServer();
    const client = createTestWhatsAppClient(server, {
      appSecret: "fixture-app-secret",
    });
    await client.getNode({ path: MOCK_WABA_ID, fields: ["id"] });
    expect(server.getLastAuthorization()).toBe(
      `Bearer ${FAKE_WHATSAPP_ACCESS_TOKEN}`,
    );
    expect(server.getLastAppSecretProof()).toBe(
      computeAppSecretProof(FAKE_WHATSAPP_ACCESS_TOKEN, "fixture-app-secret"),
    );
    await server.close();
  });

  it("retries read-only rate limit once", async () => {
    const server = await startMockWhatsAppHttpServer({
      mode: "rate_limit_once",
    });
    const client = createTestWhatsAppClient(server);
    await client.getNode({ path: MOCK_WABA_ID, fields: ["id"] });
    expect(server.getRequestCount()).toBe(2);
    await server.close();
  });
});
