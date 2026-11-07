#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadJiraConfig } from "./config.js";
import { createJiraConnector } from "./connector.js";
import { createJiraRestClient } from "./jira-rest-client.js";

const config = loadJiraConfig(process.env);
const client = createJiraRestClient({
  apiBasePath: config.apiBasePath,
  authorizationHeader: config.authorizationHeader,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createJiraConnector({
  client,
  config,
  credentialForRedaction: config.credentialForRedaction,
});

await serveStdio(connector);
