#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadTavilyConfig } from "./config.js";
import { createTavilyConnector } from "./connector.js";
import { createTavilyRestClient } from "./tavily-rest-client.js";

const config = loadTavilyConfig(process.env);
const client = createTavilyRestClient({
  apiKey: config.apiKey,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createTavilyConnector({
  client,
  apiKeyForRedaction: config.apiKey,
});

await serveStdio(connector);
