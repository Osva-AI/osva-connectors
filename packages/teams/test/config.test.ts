import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import {
  TEAMS_ACCESS_TOKEN_ENV,
  TEAMS_ALLOWED_CHANNEL_DESTINATIONS_ENV,
  TEAMS_ALLOWED_CHAT_DESTINATIONS_ENV,
  TEAMS_HOST_SEND_APPROVED_ENV,
  TEAMS_SEND_ENABLED_ENV,
  TEAMS_ALLOWED_TEAM_IDS_ENV,
} from "../src/constants.js";
import { loadTeamsConfig } from "../src/config.js";
import {
  FIXTURE_CHANNEL_ID,
  FIXTURE_CHAT_ID,
  FIXTURE_TEAM_ID,
} from "./fixtures/mock-teams-http-server.js";

describe("loadTeamsConfig", () => {
  it("requires access token", () => {
    expect(() => loadTeamsConfig({})).toThrow(ConnectorSdkError);
  });

  it("accepts read-only defaults with token", () => {
    const c = loadTeamsConfig({
      [TEAMS_ACCESS_TOKEN_ENV]: "token",
    });
    expect(c.sendEnabled).toBe(false);
    expect(c.accessToken).toBe("token");
  });

  it("requires destination allowlists when send is enabled", () => {
    expect(() =>
      loadTeamsConfig({
        [TEAMS_ACCESS_TOKEN_ENV]: "token",
        [TEAMS_SEND_ENABLED_ENV]: "true",
        [TEAMS_HOST_SEND_APPROVED_ENV]: "true",
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("accepts send flags with destination allowlists", () => {
    const c = loadTeamsConfig({
      [TEAMS_ACCESS_TOKEN_ENV]: "token",
      [TEAMS_SEND_ENABLED_ENV]: "true",
      [TEAMS_HOST_SEND_APPROVED_ENV]: "true",
      [TEAMS_ALLOWED_CHANNEL_DESTINATIONS_ENV]: `${FIXTURE_TEAM_ID}:${FIXTURE_CHANNEL_ID}`,
      [TEAMS_ALLOWED_CHAT_DESTINATIONS_ENV]: FIXTURE_CHAT_ID,
    });
    expect(c.sendEnabled).toBe(true);
    expect(c.allowedChannelDestinations?.length).toBe(1);
    expect(c.allowedChatDestinations?.length).toBe(1);
  });

  it("parses tri-state empty allowlist as deny-all", () => {
    const c = loadTeamsConfig({
      [TEAMS_ACCESS_TOKEN_ENV]: "token",
      [TEAMS_ALLOWED_TEAM_IDS_ENV]: "   ",
    });
    expect(c.allowedTeamIds).toEqual([]);
  });
});
