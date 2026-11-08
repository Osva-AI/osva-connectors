#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadMixpanelConfig } from "./config.js";
import { createMixpanelConnector } from "./connector.js";
import { createMixpanelAuthProvider } from "./mixpanel-auth.js";
import { createMixpanelRestClient } from "./mixpanel-rest-client.js";

const config = loadMixpanelConfig(process.env);
const authProvider = createMixpanelAuthProvider({
  username: config.serviceAccountUsername,
  secret: config.serviceAccountSecret,
});
const client = createMixpanelRestClient({
  authProvider,
  projectId: config.projectId,
  region: config.region,
  ...(config.workspaceId !== undefined
    ? { workspaceId: config.workspaceId }
    : {}),
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createMixpanelConnector({
  client,
  config,
  credentialsForRedaction: {
    username: config.serviceAccountUsername,
    secret: config.serviceAccountSecret,
  },
});

await serveStdio(connector);
