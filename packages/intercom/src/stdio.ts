#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";
import { loadIntercomConfig } from "./config.js";
import { createIntercomConnector } from "./connector.js";
import { createIntercomRestClient } from "./intercom-rest-client.js";

const config = loadIntercomConfig(process.env);
const client = createIntercomRestClient({
  apiBaseUrl: config.apiBaseUrl,
  pinnedOrigin: config.pinnedOrigin,
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
await serveStdio(
  createIntercomConnector({
    client,
    config,
    accessTokenForRedaction: config.accessToken,
  }),
);
