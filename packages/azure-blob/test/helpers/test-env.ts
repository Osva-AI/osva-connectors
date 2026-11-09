import type { AzureBlobConfig } from "../../src/schemas.js";

export const TEST_ACCOUNT = "fixtureaccount";

export function defaultTestAzureBlobConfig(
  overrides: Partial<AzureBlobConfig> = {},
): AzureBlobConfig {
  return {
    accountName: TEST_ACCOUNT,
    requestTimeoutMs: 5_000,
    accountWideContainerDiscovery: false,
    createEnabled: false,
    replaceEnabled: false,
    hostWritesApproved: false,
    allowedContainersRead: { "fixtures-container": ["docs/"] },
    allowedContainersWrite: { "fixtures-container": ["docs/"] },
    ...overrides,
  };
}
