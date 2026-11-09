import type { GcsConfig } from "../../src/schemas.js";

export const TEST_PROJECT_ID = "fixture-project";

export function defaultTestGcsConfig(
  overrides: Partial<GcsConfig> = {},
): GcsConfig {
  return {
    projectId: TEST_PROJECT_ID,
    requestTimeoutMs: 5_000,
    accountWideBucketDiscovery: false,
    createEnabled: false,
    replaceEnabled: false,
    hostWritesApproved: false,
    allowedBucketsRead: { "fixtures-bucket": ["docs/"] },
    allowedBucketsWrite: { "fixtures-bucket": ["docs/"] },
    ...overrides,
  };
}
