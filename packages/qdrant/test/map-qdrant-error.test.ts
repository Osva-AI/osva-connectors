import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { mapQdrantError } from "../src/map-qdrant-error.js";

describe("mapQdrantError", () => {
  it("maps 401 to UNAUTHORIZED", () => {
    const err = mapQdrantError({
      kind: "http",
      status: 401,
      qdrantMessage: "Invalid API key",
    });
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("preserves ConnectorSdkError", () => {
    const original = new ConnectorSdkError("FORBIDDEN", "nope");
    expect(mapQdrantError(original)).toBe(original);
  });
});
