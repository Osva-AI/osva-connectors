#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";
import { loadSalesforceConfig } from "./config.js";
import { createSalesforceConnector } from "./connector.js";
import { createSalesforceRestClient } from "./salesforce-rest-client.js";

const config = loadSalesforceConfig(process.env);
const client = createSalesforceRestClient({
  apiDataBaseUrl: config.apiDataBaseUrl,
  pinnedOrigin: config.pinnedOrigin,
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
await serveStdio(
  createSalesforceConnector({
    client,
    config,
    accessTokenForRedaction: config.accessToken,
  }),
);
