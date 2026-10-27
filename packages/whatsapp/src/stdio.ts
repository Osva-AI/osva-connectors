#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadWhatsAppConfig } from "./config.js";
import { createWhatsAppConnector } from "./connector.js";
import { createWhatsAppGraphClient } from "./whatsapp-graph-client.js";

const config = loadWhatsAppConfig(process.env);
const client = createWhatsAppGraphClient({
  accessToken: config.accessToken,
  ...(config.appSecret !== undefined ? { appSecret: config.appSecret } : {}),
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createWhatsAppConnector({
  client,
  config,
  accessTokenForRedaction: config.accessToken,
});

await serveStdio(connector);
