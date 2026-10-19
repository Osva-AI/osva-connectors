#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGa4Config } from "./config.js";
import { createGa4Connector } from "./connector.js";
import { createGoogleAuthTokenProvider } from "./ga4-auth.js";
import { createGa4RestClient } from "./ga4-rest-client.js";

const config = loadGa4Config(process.env);
const tokenProvider = createGoogleAuthTokenProvider();
const client = createGa4RestClient({
  tokenProvider,
  requestTimeoutMs: config.requestTimeoutMs,
});
const connector = createGa4Connector({
  client,
  ...(config.defaultPropertyId !== undefined
    ? { defaultPropertyId: config.defaultPropertyId }
    : {}),
});

await serveStdio(connector);
