#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadAzureBlobConfig } from "./config.js";
import { createAzureBlobConnector } from "./connector.js";
import { createAzureBlobSdkProviderClient } from "./provider-sdk-client.js";

const config = loadAzureBlobConfig(process.env);
const client = createAzureBlobSdkProviderClient({
  accountName: config.accountName,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createAzureBlobConnector({ client, config });

await serveStdio(connector);
