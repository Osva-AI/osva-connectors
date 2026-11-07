import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { parsePineconeMetadataFilter } from "../src/metadata-filter.js";

describe("parsePineconeMetadataFilter", () => {
  it("accepts $eq metadata filter", () => {
    const filter = { genre: { $eq: "documentary" } };
    expect(parsePineconeMetadataFilter(filter)).toEqual(filter);
  });

  it("rejects unsupported operators", () => {
    expect(() =>
      parsePineconeMetadataFilter({ genre: { $regex: ".*" } }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects empty filter object", () => {
    expect(() => parsePineconeMetadataFilter({})).toThrow(ConnectorSdkError);
  });
});
