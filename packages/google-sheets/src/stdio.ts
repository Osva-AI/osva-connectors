#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGoogleSheetsConfig } from "./config.js";
import { createGoogleSheetsConnector } from "./connector.js";
import { SHEETS_FULL_SCOPE, SHEETS_READONLY_SCOPE } from "./constants.js";
import { createGoogleAuthTokenProvider } from "./sheets-auth.js";
import { createSheetsRestClient } from "./sheets-rest-client.js";

const config = loadGoogleSheetsConfig(process.env);
const tokenProvider = createGoogleAuthTokenProvider({
  scopes: [config.writeEnabled ? SHEETS_FULL_SCOPE : SHEETS_READONLY_SCOPE],
});
const client = createSheetsRestClient({
  tokenProvider,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createGoogleSheetsConnector({
  client,
  config,
});

await serveStdio(connector);
