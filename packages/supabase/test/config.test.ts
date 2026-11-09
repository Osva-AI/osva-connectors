import { ConnectorSdkError } from "@osva-ai/connector-sdk";
import { describe, expect, it } from "vitest";

import { loadSupabaseConfig } from "../src/config.js";
import {
  SUPABASE_ALLOWED_TABLES_ENV,
  SUPABASE_PROJECT_URL_ENV,
  SUPABASE_PUBLISHABLE_KEY_ENV,
  SUPABASE_USER_ACCESS_TOKEN_ENV,
} from "../src/constants.js";
import { makeSupabaseJwt } from "./helpers/jwt-fixture.js";

describe("loadSupabaseConfig", () => {
  it("parses HTTPS project URL and rejects service_role JWT", () => {
    const anon = makeSupabaseJwt("anon");
    const service = makeSupabaseJwt("service_role");
    const env = {
      [SUPABASE_PROJECT_URL_ENV]: "https://abc123.supabase.co",
      [SUPABASE_PUBLISHABLE_KEY_ENV]: anon,
      [SUPABASE_USER_ACCESS_TOKEN_ENV]: anon,
      [SUPABASE_ALLOWED_TABLES_ENV]: JSON.stringify({
        public: { users: { columns: ["id"], lookupColumn: "id" } },
      }),
    };
    const config = loadSupabaseConfig(env);
    expect(config.pinnedOrigin).toBe("https://abc123.supabase.co");
    expect(config.projectRef).toBe("abc123");
    expect(() =>
      loadSupabaseConfig({
        ...env,
        [SUPABASE_USER_ACCESS_TOKEN_ENV]: service,
      }),
    ).toThrow(ConnectorSdkError);
  });

  it("rejects sb_secret publishable keys", () => {
    const anon = makeSupabaseJwt("anon");
    expect(() =>
      loadSupabaseConfig({
        [SUPABASE_PROJECT_URL_ENV]: "https://abc123.supabase.co",
        [SUPABASE_PUBLISHABLE_KEY_ENV]: "sb_secret_fixture",
        [SUPABASE_USER_ACCESS_TOKEN_ENV]: anon,
      }),
    ).toThrow(ConnectorSdkError);
  });
});
