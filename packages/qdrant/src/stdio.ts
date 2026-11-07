#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadQdrantConfig } from "./config.js";
import { createQdrantConnector } from "./connector.js";
import { createQdrantRestClient } from "./qdrant-rest-client.js";

const config = loadQdrantConfig(process.env);
const client = createQdrantRestClient({
  baseUrl: config.baseUrl,
  ...(config.apiKey !== undefined ? { apiKey: config.apiKey } : {}),
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createQdrantConnector({
  client,
  config,
  ...(config.apiKey !== undefined ? { apiKeyForRedaction: config.apiKey } : {}),
});

await serveStdio(connector);
