#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadMetaAdsConfig } from "./config.js";
import { createMetaAdsConnector } from "./connector.js";
import { createMetaGraphClient } from "./meta-graph-client.js";

const config = loadMetaAdsConfig(process.env);
const client = createMetaGraphClient({
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
  ...(config.appSecret !== undefined ? { appSecret: config.appSecret } : {}),
});
const connector = createMetaAdsConnector({
  client,
  maxRows: config.maxRows,
  accessTokenForRedaction: config.accessToken,
  ...(config.allowedAccountIds !== undefined
    ? { allowedAccountIds: config.allowedAccountIds }
    : {}),
});

await serveStdio(connector);
