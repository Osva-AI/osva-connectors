import { describe, expect, it } from "vitest";

import {
  channelInfoInputSchema,
  messageHistoryInputSchema,
} from "../src/tool-schemas.js";
import { MOCK_CHANNEL_PUBLIC } from "./fixtures/mock-slack-http-server.js";

describe("tool schemas", () => {
  it("accepts valid channel info input", () => {
    expect(
      channelInfoInputSchema.safeParse({ channelId: MOCK_CHANNEL_PUBLIC })
        .success,
    ).toBe(true);
  });

  it("rejects invalid message timestamps", () => {
    expect(
      messageHistoryInputSchema.safeParse({
        channelId: MOCK_CHANNEL_PUBLIC,
        oldest: "not-a-ts",
      }).success,
    ).toBe(false);
  });
});
