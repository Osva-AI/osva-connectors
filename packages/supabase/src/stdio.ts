#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadSupabaseConfig } from "./config.js";
import { createSupabaseConnector } from "./connector.js";
import { createSupabaseRestClient } from "./supabase-rest-client.js";

const config = loadSupabaseConfig(process.env);
const client = createSupabaseRestClient({
  restBaseUrl: config.restBaseUrl,
  pinnedOrigin: config.pinnedOrigin,
  publishableKey: config.publishableKey,
  userAccessToken: config.userAccessToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createSupabaseConnector({
  client,
  config,
  credentialsForRedaction: {
    publishableKey: config.publishableKey,
    userAccessToken: config.userAccessToken,
  },
});

await serveStdio(connector);
