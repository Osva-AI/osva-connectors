import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { GRAPH_API_HOST } from "../src/constants.js";
import {
  OUTLOOK_NEXT_LINK_SCOPES,
  validateNextLinkInput,
} from "../src/graph-pagination.js";

describe("Outlook Graph pagination scopes", () => {
  it("rejects cross-resource nextLink for mail folder list", () => {
    expect(() =>
      validateNextLinkInput(
        "https://graph.microsoft.com/v1.0/me/messages?$skiptoken=x",
        GRAPH_API_HOST,
        OUTLOOK_NEXT_LINK_SCOPES.mailFolders,
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects nextLink for a different mail folder", () => {
    const folderA = "AQMkADAwATM0MDAAMS0wMDAALTAwCgAuAAA=";
    const folderB = "AQMkADAwATM0MDAAMS0wMDAALTAwCgAuAAAZZZZZZZ";
    expect(() =>
      validateNextLinkInput(
        `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(folderB)}/messages?$skiptoken=page2`,
        GRAPH_API_HOST,
        OUTLOOK_NEXT_LINK_SCOPES.messages,
        { kind: "mailFolder", resourceId: folderA },
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("allows same-resource nextLink for mail folders", () => {
    const link =
      "https://graph.microsoft.com/v1.0/me/mailFolders?$skiptoken=page2";
    expect(
      validateNextLinkInput(
        link,
        GRAPH_API_HOST,
        OUTLOOK_NEXT_LINK_SCOPES.mailFolders,
      ),
    ).toBe(link);
  });
});
