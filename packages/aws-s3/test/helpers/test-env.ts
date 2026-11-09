import type { S3Config } from "../../src/schemas.js";

export const TEST_REGION = "us-east-1";

export function defaultTestS3Config(
  overrides: Partial<S3Config> = {},
): S3Config {
  return {
    region: TEST_REGION,
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
