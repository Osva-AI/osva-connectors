#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadKlaviyoConfig } from "./config.js";
import { createKlaviyoConnector } from "./connector.js";
import { createKlaviyoRestClient } from "./klaviyo-rest-client.js";

const config = loadKlaviyoConfig(process.env);
const client = createKlaviyoRestClient({
  privateApiKey: config.privateApiKey,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createKlaviyoConnector({
  client,
  maxRows: config.maxRows,
  privateApiKeyForRedaction: config.privateApiKey,
});

await serveStdio(connector);
