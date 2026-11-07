#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadLinearConfig } from "./config.js";
import { createLinearConnector } from "./connector.js";
import { createLinearGraphqlClient } from "./linear-graphql-client.js";

const config = loadLinearConfig(process.env);
const client = createLinearGraphqlClient({
  authorizationHeader: config.authorizationHeader,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createLinearConnector({
  client,
  config,
  credentialForRedaction: config.credentialForRedaction,
});

await serveStdio(connector);
