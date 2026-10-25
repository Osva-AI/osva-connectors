#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGscConfig } from "./config.js";
import { createGscConnector } from "./connector.js";
import { GSC_READONLY_SCOPE, GSC_URL_INSPECTION_SCOPE } from "./constants.js";
import { createGoogleAuthTokenProvider } from "./gsc-auth.js";
import { createGscRestClient } from "./gsc-rest-client.js";

const config = loadGscConfig(process.env);
const tokenProvider = createGoogleAuthTokenProvider({
  scopes: [GSC_READONLY_SCOPE],
});
const urlInspectionTokenProvider = createGoogleAuthTokenProvider({
  scopes: [GSC_URL_INSPECTION_SCOPE],
});
const client = createGscRestClient({
  tokenProvider,
  urlInspectionTokenProvider,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createGscConnector({
  client,
  ...(config.defaultSiteUrl !== undefined
    ? { defaultSiteUrl: config.defaultSiteUrl }
    : {}),
});

await serveStdio(connector);
