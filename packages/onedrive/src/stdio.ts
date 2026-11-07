#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadOneDriveConfig } from "./config.js";
import { createOneDriveConnector } from "./connector.js";
import { GRAPH_API_HOST } from "./constants.js";
import { createStaticBearerTokenProvider } from "./onedrive-auth.js";
import { createOneDriveRestClient } from "./onedrive-rest-client.js";

const config = loadOneDriveConfig(process.env);
const tokenProvider = createStaticBearerTokenProvider(config.accessToken);
const client = createOneDriveRestClient({
  tokenProvider,
  requestTimeoutMs: config.requestTimeoutMs,
  smallUploadMaxBytes: config.smallUploadMaxBytes,
});
const connector = createOneDriveConnector({
  client,
  config,
  graphApiHost: GRAPH_API_HOST,
  accessTokenForRedaction: config.accessToken,
});

await serveStdio(connector);
