#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadExaConfig } from "./config.js";
import { createExaConnector } from "./connector.js";
import { createExaRestClient } from "./exa-rest-client.js";

const config = loadExaConfig(process.env);
const client = createExaRestClient({
  apiKey: config.apiKey,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createExaConnector({
  client,
  apiKeyForRedaction: config.apiKey,
});

await serveStdio(connector);
