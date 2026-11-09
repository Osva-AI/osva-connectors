#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGcsConfig } from "./config.js";
import { createGcsConnector } from "./connector.js";
import { createGcsSdkProviderClient } from "./provider-sdk-client.js";

const config = loadGcsConfig(process.env);
const client = createGcsSdkProviderClient({
  projectId: config.projectId,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createGcsConnector({ client, config });

await serveStdio(connector);
