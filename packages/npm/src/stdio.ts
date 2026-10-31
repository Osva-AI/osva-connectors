#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadNpmConfig } from "./config.js";
import { createNpmConnector } from "./connector.js";
import { DEFAULT_NPM_USER_AGENT } from "./constants.js";

const config = loadNpmConfig(process.env);
const connector = createNpmConnector({
  timeoutMs: config.requestTimeoutMs,
  userAgent: config.userAgent ?? DEFAULT_NPM_USER_AGENT,
});

await serveStdio(connector);
