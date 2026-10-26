#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGoogleDriveConfig } from "./config.js";
import { createGoogleDriveConnector } from "./connector.js";
import { DRIVE_READONLY_SCOPE } from "./constants.js";
import { createGoogleAuthTokenProvider } from "./drive-auth.js";
import { createDriveRestClient } from "./drive-rest-client.js";

const config = loadGoogleDriveConfig(process.env);
const tokenProvider = createGoogleAuthTokenProvider({
  scopes: [DRIVE_READONLY_SCOPE],
});
const client = createDriveRestClient({
  tokenProvider,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createGoogleDriveConnector({
  client,
  maxContentBytes: config.maxContentBytes,
  ...(config.allowedDriveIds !== undefined
    ? { allowedDriveIds: config.allowedDriveIds }
    : {}),
});

await serveStdio(connector);
