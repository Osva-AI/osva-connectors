import { describe, expect, it } from "vitest";

import { loadAzureBlobConfig } from "../src/config.js";

describe("loadAzureBlobConfig", () => {
  it("requires account name", () => {
    expect(() =>
      loadAzureBlobConfig({
        OSVA_CONNECTOR_AZURE_BLOB_ALLOWED_CONTAINERS_READ: '{"b":["p/"]}',
      }),
    ).toThrow(/account name/i);
  });

  it("parses scope maps and flags", () => {
    const config = loadAzureBlobConfig({
      OSVA_CONNECTOR_AZURE_BLOB_ACCOUNT_NAME: "fixtureaccount",
      OSVA_CONNECTOR_AZURE_BLOB_ALLOWED_CONTAINERS_READ: '{"logs":["2024/"]}',
      OSVA_CONNECTOR_AZURE_BLOB_CREATE_ENABLED: "true",
      OSVA_CONNECTOR_AZURE_BLOB_HOST_WRITES_APPROVED: "1",
    });
    expect(config.accountName).toBe("fixtureaccount");
    expect(config.allowedContainersRead).toEqual({ logs: ["2024/"] });
    expect(config.createEnabled).toBe(true);
    expect(config.hostWritesApproved).toBe(true);
  });
});
