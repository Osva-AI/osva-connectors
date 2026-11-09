import { describe, expect, it } from "vitest";

import { loadGcsConfig } from "../src/config.js";

describe("loadGcsConfig", () => {
  it("requires region", () => {
    expect(() =>
      loadGcsConfig({
        OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_READ: '{"b":["p/"]}',
      }),
    ).toThrow(/project id/i);
  });

  it("parses scope maps and flags", () => {
    const config = loadGcsConfig({
      OSVA_CONNECTOR_GCS_PROJECT_ID: "fixture-project",
      OSVA_CONNECTOR_GCS_ALLOWED_BUCKETS_READ: '{"logs":["2024/"]}',
      OSVA_CONNECTOR_GCS_CREATE_ENABLED: "true",
      OSVA_CONNECTOR_GCS_HOST_WRITES_APPROVED: "1",
    });
    expect(config.projectId).toBe("fixture-project");
    expect(config.allowedBucketsRead).toEqual({ logs: ["2024/"] });
    expect(config.createEnabled).toBe(true);
    expect(config.hostWritesApproved).toBe(true);
  });
});
