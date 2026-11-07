import { describe, expect, it } from "vitest";

import {
  eventCreateInputSchema,
  messageSendInputSchema,
} from "../src/tool-schemas.js";

describe("Outlook: host approval is not a tool input field", () => {
  it("send and event create schemas do not expose host gates", () => {
    expect(Object.keys(messageSendInputSchema.shape)).toEqual(["message"]);
    expect(eventCreateInputSchema.shape).not.toHaveProperty("writeEnabled");
    expect(eventCreateInputSchema.shape).not.toHaveProperty(
      "hostWritesApproved",
    );
    expect(eventCreateInputSchema.shape).not.toHaveProperty("sendEnabled");
    expect(eventCreateInputSchema.shape).not.toHaveProperty("hostSendApproved");
  });
});
