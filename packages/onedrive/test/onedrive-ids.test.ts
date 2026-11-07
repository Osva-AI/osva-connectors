import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { GRAPH_API_HOST } from "../src/constants.js";
import {
  assertSafeUploadFilename,
  ONEDRIVE_NEXT_LINK_SCOPES,
  validateGraphNextLink,
} from "../src/onedrive-ids.js";

describe("onedrive ids and nextLink", () => {
  it("rejects path traversal filenames", () => {
    expect(() => assertSafeUploadFilename("../evil.txt")).toThrow(
      ConnectorSdkError,
    );
    expect(() => assertSafeUploadFilename("folder/x.txt")).toThrow(
      ConnectorSdkError,
    );
  });

  it("allows safe basename", () => {
    expect(assertSafeUploadFilename("report.txt")).toBe("report.txt");
  });

  it("rejects evil nextLink host", () => {
    expect(() =>
      validateGraphNextLink(
        "https://evil.example/v1.0/me/drive",
        GRAPH_API_HOST,
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("allows graph production nextLink", () => {
    const link =
      "https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=abc";
    expect(validateGraphNextLink(link, GRAPH_API_HOST)).toBe(link);
  });

  it("rejects list nextLink reused for search scope", () => {
    const link =
      "https://graph.microsoft.com/v1.0/me/drive/root/children?$skiptoken=abc";
    expect(() =>
      validateGraphNextLink(
        link,
        GRAPH_API_HOST,
        ONEDRIVE_NEXT_LINK_SCOPES.driveSearch,
      ),
    ).toThrow(ConnectorSdkError);
  });
});
