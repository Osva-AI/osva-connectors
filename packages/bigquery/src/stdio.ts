#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadBigqueryConfig } from "./config.js";
import { createBigqueryConnector } from "./connector.js";
import { createBigQuerySdkProviderClient } from "./provider-sdk-client.js";

const config = loadBigqueryConfig(process.env);
const client = createBigQuerySdkProviderClient({
  projectId: config.projectId,
  location: config.location,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createBigqueryConnector({ client, config });

await serveStdio(connector);
