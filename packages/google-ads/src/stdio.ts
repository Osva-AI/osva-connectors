#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGoogleAdsConfig } from "./config.js";
import { createGoogleAdsConnector } from "./connector.js";
import { createGoogleAuthTokenProvider } from "./google-ads-auth.js";
import { createGoogleAdsRestClient } from "./google-ads-rest-client.js";

const config = loadGoogleAdsConfig(process.env);
const tokenProvider = createGoogleAuthTokenProvider();
const client = createGoogleAdsRestClient({
  tokenProvider,
  requestTimeoutMs: config.requestTimeoutMs,
  ...(config.loginCustomerId !== undefined
    ? { loginCustomerId: config.loginCustomerId }
    : {}),
  ...(config.developerToken !== undefined
    ? { developerToken: config.developerToken }
    : {}),
});
const connector = createGoogleAdsConnector({
  client,
  maxRows: config.maxRows,
  ...(config.allowedCustomerIds !== undefined
    ? { allowedCustomerIds: config.allowedCustomerIds }
    : {}),
});

await serveStdio(connector);
