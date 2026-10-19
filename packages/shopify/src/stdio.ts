#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadShopifyConfig } from "./config.js";
import { createShopifyConnector } from "./connector.js";
import { createShopifyGraphqlClient } from "./shopify-graphql-client.js";

const config = loadShopifyConfig(process.env);
const client = createShopifyGraphqlClient({
  graphqlEndpoint: config.graphqlEndpoint,
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createShopifyConnector({
  client,
  accessToken: config.accessToken,
});

await serveStdio(connector);
