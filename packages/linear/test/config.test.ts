import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadLinearConfig } from "../src/config.js";
import {
  LINEAR_ACCESS_TOKEN_ENV,
  LINEAR_API_KEY_ENV,
  LINEAR_ALLOWED_TEAM_IDS_ENV,
} from "../src/constants.js";

describe("loadLinearConfig", () => {
  it("requires api key or access token", () => {
    expect(() => loadLinearConfig({})).toThrow(ConnectorSdkError);
  });

  it("prefers personal API key authorization without Bearer", () => {
    const config = loadLinearConfig({
      [LINEAR_API_KEY_ENV]: "lin_api_fixture",
      [LINEAR_ACCESS_TOKEN_ENV]: "oauth-should-not-win",
    });
    expect(config.authorizationHeader).toBe("lin_api_fixture");
    expect(config.credentialForRedaction).toBe("lin_api_fixture");
  });

  it("uses Bearer authorization for OAuth access token", () => {
    const config = loadLinearConfig({
      [LINEAR_ACCESS_TOKEN_ENV]: "oauth_fixture",
    });
    expect(config.authorizationHeader).toBe("Bearer oauth_fixture");
  });

  it("defaults to read-only mutation flags", () => {
    const config = loadLinearConfig({
      [LINEAR_API_KEY_ENV]: "lin_api_fixture",
    });
    expect(config.writeEnabled).toBe(false);
    expect(config.hostMutationsApproved).toBe(false);
  });

  it("parses allowed team ids", () => {
    const config = loadLinearConfig({
      [LINEAR_API_KEY_ENV]: "lin_api_fixture",
      [LINEAR_ALLOWED_TEAM_IDS_ENV]:
        "11111111-1111-4111-8111-111111111111, 22222222-2222-4222-8222-222222222222",
    });
    expect(config.allowedTeamIds).toHaveLength(2);
  });
});
