import { describe, expect, it } from "vitest";

import { loadBigqueryConfig } from "../src/config.js";

describe("loadBigqueryConfig", () => {
  it("requires project id", () => {
    expect(() =>
      loadBigqueryConfig({
        OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS: "analytics",
      }),
    ).toThrow(/project id/i);
  });

  it("parses allowlists and timeouts", () => {
    const config = loadBigqueryConfig({
      OSVA_CONNECTOR_BIGQUERY_PROJECT_ID: "fixture-project",
      OSVA_CONNECTOR_BIGQUERY_LOCATION: "EU",
      OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS: "analytics,metrics",
      OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES:
        '{"analytics":{"events":["event_name"]}}',
      OSVA_CONNECTOR_BIGQUERY_MAX_BYTES_BILLED: "5000000",
      OSVA_CONNECTOR_BIGQUERY_QUERY_TIMEOUT_MS: "45000",
    });
    expect(config.projectId).toBe("fixture-project");
    expect(config.location).toBe("EU");
    expect(config.allowedDatasets).toEqual(["analytics", "metrics"]);
    expect(config.allowedTables?.analytics?.events).toEqual(["event_name"]);
    expect(config.maxBytesBilled).toBe(5_000_000);
    expect(config.queryTimeoutMs).toBe(45_000);
  });

  it("treats a missing dataset allowlist as unset, not deny-all", () => {
    const config = loadBigqueryConfig({
      OSVA_CONNECTOR_BIGQUERY_PROJECT_ID: "fixture-project",
    });
    expect(config.allowedDatasets).toBeUndefined();
    expect(config.allowedTables).toBeUndefined();
  });

  it("treats an empty dataset allowlist as deny-all", () => {
    const config = loadBigqueryConfig({
      OSVA_CONNECTOR_BIGQUERY_PROJECT_ID: "fixture-project",
      OSVA_CONNECTOR_BIGQUERY_ALLOWED_DATASETS: "   ",
      OSVA_CONNECTOR_BIGQUERY_ALLOWED_TABLES: "",
    });
    expect(config.allowedDatasets).toEqual([]);
    expect(config.allowedTables).toEqual({});
  });
});
