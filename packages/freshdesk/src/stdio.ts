#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";
import { loadFreshdeskConfig } from "./config.js";
import { createFreshdeskConnector } from "./connector.js";
import { createFreshdeskRestClient } from "./freshdesk-rest-client.js";

const config = loadFreshdeskConfig(process.env);
const client = createFreshdeskRestClient({
  apiBaseUrl: config.apiBaseUrl,
  pinnedOrigin: config.pinnedOrigin,
  apiKey: config.apiKey,
  requestTimeoutMs: config.requestTimeoutMs,
});
await serveStdio(
  createFreshdeskConnector({
    client,
    config,
    apiKeyForRedaction: config.apiKey,
  }),
);
