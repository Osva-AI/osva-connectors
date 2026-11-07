#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadTeamsConfig } from "./config.js";
import { createTeamsConnector } from "./connector.js";
import { createGraphRestClient } from "./graph-rest-client.js";

const config = loadTeamsConfig(process.env);

const client = createGraphRestClient({
  accessToken: config.accessToken,
  requestTimeoutMs: config.requestTimeoutMs,
  graphApiBase: config.graphApiBase,
});

const connector = createTeamsConnector({
  client,
  config,
  accessTokenForRedaction: config.accessToken,
});

await serveStdio(connector);
