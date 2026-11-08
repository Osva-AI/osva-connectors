#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { createAmplitudeRestClient } from "./amplitude-rest-client.js";
import { loadAmplitudeConfig } from "./config.js";
import { createAmplitudeConnector } from "./connector.js";

const config = loadAmplitudeConfig(process.env);
const client = createAmplitudeRestClient({
  apiKey: config.apiKey,
  secretKey: config.secretKey,
  requestTimeoutMs: config.requestTimeoutMs,
  apiHost: config.apiHost,
});
const connector = createAmplitudeConnector({
  client,
  ...(config.allowedChartIds !== undefined
    ? { allowedChartIds: config.allowedChartIds }
    : {}),
  apiKeyForRedaction: config.apiKey,
  secretKeyForRedaction: config.secretKey,
});

await serveStdio(connector);
