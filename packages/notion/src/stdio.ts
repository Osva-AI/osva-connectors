#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadNotionConfig } from "./config.js";
import { createNotionConnector } from "./connector.js";
import { createNotionRestClient } from "./notion-rest-client.js";

const config = loadNotionConfig(process.env);
const client = createNotionRestClient({
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
  apiVersion: config.apiVersion,
});
const connector = createNotionConnector({
  client,
  config,
  accessTokenForRedaction: config.accessToken,
});

await serveStdio(connector);
