#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";
import { loadZohoConfig } from "./config.js";
import { createZohoConnector } from "./connector.js";
import { createZohoRestClient } from "./zoho-rest-client.js";

const config = loadZohoConfig(process.env);
const client = createZohoRestClient({
  apiBaseUrl: config.apiBaseUrl,
  pinnedOrigin: config.pinnedOrigin,
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
await serveStdio(
  createZohoConnector({
    client,
    config,
    accessTokenForRedaction: config.accessToken,
  }),
);
