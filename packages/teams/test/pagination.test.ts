import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  assertGraphNextLinkAllowed,
  TEAMS_NEXT_LINK_SCOPES,
  validateTeamsNextLinkInput,
} from "../src/graph-pagination.js";
import { GRAPH_API_HOST } from "../src/constants.js";

describe("Graph pagination validation", () => {
  it("rejects nextLink to unexpected host", () => {
    expect(() =>
      assertGraphNextLinkAllowed(
        "https://evil.example/v1.0/me/joinedTeams",
        GRAPH_API_HOST,
      ),
    ).toThrow(ConnectorSdkError);
  });

  it("allows graph.microsoft.com next links", () => {
    expect(() =>
      assertGraphNextLinkAllowed(
        "https://graph.microsoft.com/v1.0/me/joinedTeams?$skiptoken=abc",
        GRAPH_API_HOST,
      ),
    ).not.toThrow();
  });

  it("rejects cross-resource nextLink for channel messages", () => {
    expect(() =>
      validateTeamsNextLinkInput(
        "https://graph.microsoft.com/v1.0/me/joinedTeams?$skiptoken=abc",
        GRAPH_API_HOST,
        TEAMS_NEXT_LINK_SCOPES.channelMessages,
      ),
    ).toThrow(ConnectorSdkError);
  });
});
