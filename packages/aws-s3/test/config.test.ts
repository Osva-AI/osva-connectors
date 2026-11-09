import { describe, expect, it } from "vitest";

import { loadS3Config } from "../src/config.js";

describe("loadS3Config", () => {
  it("requires region", () => {
    expect(() =>
      loadS3Config({
        OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ: '{"b":["p/"]}',
      }),
    ).toThrow(/region/i);
  });

  it("parses scope maps and flags", () => {
    const config = loadS3Config({
      OSVA_CONNECTOR_S3_REGION: "eu-west-1",
      OSVA_CONNECTOR_S3_ALLOWED_BUCKETS_READ: '{"logs":["2024/"]}',
      OSVA_CONNECTOR_S3_CREATE_ENABLED: "true",
      OSVA_CONNECTOR_S3_HOST_WRITES_APPROVED: "1",
    });
    expect(config.region).toBe("eu-west-1");
    expect(config.allowedBucketsRead).toEqual({ logs: ["2024/"] });
    expect(config.createEnabled).toBe(true);
    expect(config.hostWritesApproved).toBe(true);
  });
});
