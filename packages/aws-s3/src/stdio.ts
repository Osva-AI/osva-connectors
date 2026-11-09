#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadS3Config } from "./config.js";
import { createS3Connector } from "./connector.js";
import { createS3SdkProviderClient } from "./provider-sdk-client.js";

const config = loadS3Config(process.env);
const client = createS3SdkProviderClient({
  region: config.region,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createS3Connector({ client, config });

await serveStdio(connector);
