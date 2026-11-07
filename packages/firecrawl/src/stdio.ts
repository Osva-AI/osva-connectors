#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadFirecrawlConfig } from "./config.js";
import { createFirecrawlConnector } from "./connector.js";
import { createFirecrawlRestClient } from "./firecrawl-rest-client.js";

const config = loadFirecrawlConfig(process.env);
const client = createFirecrawlRestClient({
  apiKey: config.apiKey,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createFirecrawlConnector({
  client,
  config,
  apiKeyForRedaction: config.apiKey,
});

await serveStdio(connector);
