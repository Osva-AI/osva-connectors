import { describe, expect, it } from "vitest";

import { loadWhatsAppConfig } from "../src/config.js";
import {
  WHATSAPP_ACCESS_TOKEN_ENV,
  WHATSAPP_PHONE_NUMBER_ID_ENV,
  WHATSAPP_SEND_ENABLED_ENV,
  WHATSAPP_WABA_ID_ENV,
} from "../src/constants.js";
import {
  MOCK_PHONE_NUMBER_ID,
  MOCK_WABA_ID,
} from "./fixtures/mock-whatsapp-http-server.js";

describe("loadWhatsAppConfig", () => {
  it("defaults send to disabled", () => {
    const config = loadWhatsAppConfig({
      [WHATSAPP_ACCESS_TOKEN_ENV]: "token",
      [WHATSAPP_WABA_ID_ENV]: MOCK_WABA_ID,
      [WHATSAPP_PHONE_NUMBER_ID_ENV]: MOCK_PHONE_NUMBER_ID,
    });
    expect(config.sendEnabled).toBe(false);
  });

  it("rejects invalid send flag", () => {
    expect(() =>
      loadWhatsAppConfig({
        [WHATSAPP_ACCESS_TOKEN_ENV]: "token",
        [WHATSAPP_WABA_ID_ENV]: MOCK_WABA_ID,
        [WHATSAPP_PHONE_NUMBER_ID_ENV]: MOCK_PHONE_NUMBER_ID,
        [WHATSAPP_SEND_ENABLED_ENV]: "maybe",
      }),
    ).toThrow(/Send enable flag/);
  });
});
