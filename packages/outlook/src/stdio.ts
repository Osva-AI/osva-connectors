#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadOutlookConfig } from "./config.js";
import { createOutlookConnector } from "./connector.js";
import { createGraphRestClient } from "./graph-rest-client.js";

const config = loadOutlookConfig(process.env);

const client = createGraphRestClient({
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
});

const connector = createOutlookConnector({
  client,
  config,
  accessTokenForRedaction: config.accessToken,
});

await serveStdio(connector);
