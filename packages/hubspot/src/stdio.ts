#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadHubspotConfig } from "./config.js";
import { createHubspotConnector } from "./connector.js";
import { createHubspotRestClient } from "./hubspot-rest-client.js";

const config = loadHubspotConfig(process.env);
const client = createHubspotRestClient({
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createHubspotConnector({
  client,
  maxRows: config.maxRows,
  allowedObjectTypes: config.allowedObjectTypes,
  includePii: config.includePii,
  accessTokenForRedaction: config.accessToken,
});

await serveStdio(connector);
