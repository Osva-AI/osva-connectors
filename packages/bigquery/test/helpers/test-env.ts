import type { BigqueryConfig } from "../../src/schemas.js";

export const TEST_PROJECT_ID = "fixture-project";

export function defaultTestBigqueryConfig(
  overrides: Partial<BigqueryConfig> = {},
): BigqueryConfig {
  return {
    projectId: TEST_PROJECT_ID,
    location: "US",
    queryTimeoutMs: 5_000,
    requestTimeoutMs: 5_000,
    maxBytesBilled: 1_000_000_000,
    allowedDatasets: ["analytics"],
    allowedTables: {
      analytics: {
        events: ["event_name", "user_id", "value"],
      },
    },
    ...overrides,
  };
}
