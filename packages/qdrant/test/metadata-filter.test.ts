import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { parseQdrantMetadataFilter } from "../src/metadata-filter.js";

describe("parseQdrantMetadataFilter", () => {
  it("accepts must + match filter", () => {
    const filter = {
      must: [{ key: "tenant", match: { value: "acme" } }],
    };
    expect(parseQdrantMetadataFilter(filter)).toEqual(filter);
  });

  it("rejects arbitrary provider JSON", () => {
    expect(() =>
      parseQdrantMetadataFilter({ geo_radius: { center: [0, 0], radius: 1 } }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects non-finite match values", () => {
    expect(() =>
      parseQdrantMetadataFilter({
        must: [{ key: "score", match: { value: Number.NaN } }],
      }),
    ).toThrow(ConnectorSdkError);
  });
});
