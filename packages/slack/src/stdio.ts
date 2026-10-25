#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadSlackConfig } from "./config.js";
import { createSlackConnector } from "./connector.js";
import { createSlackRestClient } from "./slack-rest-client.js";

const config = loadSlackConfig(process.env);
const client = createSlackRestClient({
  botToken: config.botToken,
  requestTimeoutMs: config.requestTimeoutMs,
  ...(config.allowedChannelIds !== undefined
    ? { allowedChannelIds: config.allowedChannelIds }
    : {}),
});
const connector = createSlackConnector({
  client,
  config,
  botTokenForRedaction: config.botToken,
});

await serveStdio(connector);
