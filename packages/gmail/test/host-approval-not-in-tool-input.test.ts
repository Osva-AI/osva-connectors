import { describe, expect, it } from "vitest";

import {
  draftCreateInputSchema,
  messageSendInputSchema,
} from "../src/tool-schemas.js";

describe("Gmail: host approval is not a tool input field", () => {
  it("draft and send tool schemas only accept composed message content", () => {
    expect(Object.keys(draftCreateInputSchema.shape)).toEqual(["message"]);
    expect(Object.keys(messageSendInputSchema.shape)).toEqual(["message"]);
    const msgShape = draftCreateInputSchema.shape.message.shape;
    expect(Object.keys(msgShape)).toEqual([
      "to",
      "cc",
      "bcc",
      "subject",
      "bodyPlain",
    ]);
    for (const forbidden of [
      "hostSendApproved",
      "sendEnabled",
      "draftsEnabled",
    ]) {
      expect(msgShape).not.toHaveProperty(forbidden);
    }
  });
});
