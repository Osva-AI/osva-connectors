import { describe, expect, it } from "vitest";

import {
  channelMessageSendInputSchema,
  chatMessageSendInputSchema,
} from "../src/tool-schemas.js";

describe("Teams: host approval is not a tool input field", () => {
  it("mutation schemas do not expose send gates", () => {
    for (const schema of [
      channelMessageSendInputSchema,
      chatMessageSendInputSchema,
    ]) {
      expect(schema.shape).not.toHaveProperty("sendEnabled");
      expect(schema.shape).not.toHaveProperty("hostSendApproved");
    }
  });
});
