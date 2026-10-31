import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  parseDownloadsInput,
  parsePackageMetadataInput,
} from "../src/schemas.js";

describe("npm input schemas", () => {
  it("accepts unscoped package names", () => {
    expect(parsePackageMetadataInput({ packageName: "lodash" })).toEqual({
      packageName: "lodash",
    });
  });

  it("accepts scoped package names", () => {
    expect(parsePackageMetadataInput({ packageName: "@types/node" })).toEqual({
      packageName: "@types/node",
    });
  });

  it("rejects malformed package names", () => {
    expect(() => parsePackageMetadataInput({ packageName: "../evil" })).toThrow(
      ConnectorSdkError,
    );
    expect(() => parsePackageMetadataInput({ packageName: "@scope" })).toThrow(
      ConnectorSdkError,
    );
  });

  it("rejects invalid downloads period", () => {
    expect(() =>
      parseDownloadsInput({
        packageName: "lodash",
        period: "last-week",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("requires period for downloads", () => {
    expect(() => parseDownloadsInput({ packageName: "lodash" })).toThrow(
      ConnectorSdkError,
    );
  });
});
