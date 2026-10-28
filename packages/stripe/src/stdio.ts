#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadStripeConfig } from "./config.js";
import { createStripeConnector } from "./connector.js";
import { createStripeRestClient } from "./stripe-rest-client.js";

const config = loadStripeConfig(process.env);
const client = createStripeRestClient({
  apiKey: config.apiKey,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createStripeConnector({
  client,
  maxRows: config.maxRows,
  allowLiveMode: config.allowLiveMode,
  ...(config.allowedCustomerIds !== undefined
    ? { allowedCustomerIds: config.allowedCustomerIds }
    : {}),
  apiKeyForRedaction: config.apiKey,
});

await serveStdio(connector);
