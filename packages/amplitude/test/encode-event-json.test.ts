import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  encodeEventJsonArrayForQuery,
  encodeEventJsonForQuery,
} from "../src/encode-event-json.js";

describe("encodeEventJsonForQuery", () => {
  it("serializes event_type safely", () => {
    const encoded = encodeEventJsonForQuery({
      event_type: "View Product",
    });
    expect(JSON.parse(encoded)).toEqual({ event_type: "View Product" });
  });

  it("rejects missing event_type", () => {
    expect(() => encodeEventJsonForQuery({})).toThrow(ConnectorSdkError);
  });

  it("limits funnel events", () => {
    const events = Array.from({ length: 6 }, (_, index) => ({
      event_type: `e${index}`,
    }));
    expect(() => encodeEventJsonArrayForQuery(events, "Funnel", 5)).toThrow(
      ConnectorSdkError,
    );
  });
});
