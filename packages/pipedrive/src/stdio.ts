#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";
import { loadPipedriveConfig } from "./config.js";
import { createPipedriveConnector } from "./connector.js";
import { createPipedriveRestClient } from "./pipedrive-rest-client.js";

const config = loadPipedriveConfig(process.env);
const client = createPipedriveRestClient({
  apiBaseUrl: config.apiBaseUrl,
  pinnedOrigin: config.pinnedOrigin,
  apiToken: config.apiToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
await serveStdio(
  createPipedriveConnector({
    client,
    config,
    apiTokenForRedaction: config.apiToken,
  }),
);
