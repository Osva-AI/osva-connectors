#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";
import { createBigcommerceRestClient } from "./bigcommerce-rest-client.js";
import { loadBigcommerceConfig } from "./config.js";
import { createBigcommerceConnector } from "./connector.js";
const config = loadBigcommerceConfig(process.env);
const client = createBigcommerceRestClient({
  apiHost: config.apiHost,
  storeHash: config.storeHash,
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createBigcommerceConnector({
  client,
  config,
  accessTokenForRedaction: config.accessToken,
});
await serveStdio(connector);
