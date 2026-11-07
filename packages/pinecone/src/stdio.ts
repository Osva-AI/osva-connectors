#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadPineconeConfig } from "./config.js";
import { createPineconeConnector } from "./connector.js";
import { createPineconeRestClient } from "./pinecone-rest-client.js";

const config = loadPineconeConfig(process.env);
const client = createPineconeRestClient({
  apiKey: config.apiKey,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createPineconeConnector({
  client,
  config,
  apiKeyForRedaction: config.apiKey,
});

await serveStdio(connector);
