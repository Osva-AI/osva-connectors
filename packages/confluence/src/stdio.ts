#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadConfluenceConfig } from "./config.js";
import { createConfluenceConnector } from "./connector.js";
import { createConfluenceRestClient } from "./confluence-rest-client.js";

const config = loadConfluenceConfig(process.env);
const client = createConfluenceRestClient({
  apiBaseV2: config.apiBaseV2,
  apiBaseRest: config.apiBaseRest,
  authorizationHeader: config.authorizationHeader,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createConfluenceConnector({
  client,
  config,
  credentialForRedaction: config.credentialForRedaction,
});

await serveStdio(connector);
