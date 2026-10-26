import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { validateGaqlSelectQuery } from "../src/gaql-validator.js";

describe("GAQL validator", () => {
  it("accepts bounded performance queries", () => {
    const validated = validateGaqlSelectQuery(
      "SELECT campaign.id, segments.date, metrics.clicks FROM campaign WHERE segments.date BETWEEN '2024-01-01' AND '2024-01-07'",
      100,
    );
    expect(validated.query.toLowerCase()).toContain("limit 100");
  });

  it("rejects injection and mutations", () => {
    expect(() =>
      validateGaqlSelectQuery(
        "SELECT campaign.id FROM campaign; DROP TABLE customer",
        100,
      ),
    ).toThrow(ConnectorSdkError);
    expect(() =>
      validateGaqlSelectQuery("INSERT INTO campaign VALUES (1)", 100),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects non-allowlisted resources and fields", () => {
    expect(() =>
      validateGaqlSelectQuery(
        "SELECT secret.field FROM secret_resource WHERE segments.date BETWEEN '2024-01-01' AND '2024-01-02'",
        100,
      ),
    ).toThrow(ConnectorSdkError);
    expect(() =>
      validateGaqlSelectQuery(
        "SELECT campaign.id, segments.date, metrics.clicks FROM campaign WHERE segments.date BETWEEN '2024-01-01' AND '2024-01-02'",
        100,
      ),
    ).not.toThrow();
    expect(() =>
      validateGaqlSelectQuery(
        "SELECT campaign.id, metrics.clicks FROM campaign WHERE segments.date BETWEEN '2024-01-01' AND '2024-01-02'",
        100,
      ),
    ).toThrow(ConnectorSdkError);
  });
});
