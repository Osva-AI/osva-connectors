#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";
import { loadZendeskConfig } from "./config.js";
import { createZendeskConnector } from "./connector.js";
import { createZendeskRestClient } from "./zendesk-rest-client.js";

const config = loadZendeskConfig(process.env);
const client = createZendeskRestClient({
  apiBaseUrl: config.apiBaseUrl,
  pinnedOrigin: config.pinnedOrigin,
  email: config.email,
  apiToken: config.apiToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createZendeskConnector({
  client,
  config,
  credentialsForRedaction: {
    email: config.email,
    apiToken: config.apiToken,
  },
});
await serveStdio(connector);
