#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";
import { loadWoocommerceConfig } from "./config.js";
import { createWoocommerceConnector } from "./connector.js";
import { createWoocommerceRestClient } from "./woocommerce-rest-client.js";
const config = loadWoocommerceConfig(process.env);
const client = createWoocommerceRestClient({
  apiBaseUrl: config.apiBaseUrl,
  pinnedOrigin: config.pinnedOrigin,
  consumerKey: config.consumerKey,
  consumerSecret: config.consumerSecret,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createWoocommerceConnector({
  client,
  config,
  credentialsForRedaction: {
    consumerKey: config.consumerKey,
    consumerSecret: config.consumerSecret,
  },
});
await serveStdio(connector);
