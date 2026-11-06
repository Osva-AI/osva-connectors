#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadGmailConfig } from "./config.js";
import { createGmailConnector } from "./connector.js";
import {
  createGoogleAuthTokenProvider,
  createStaticBearerTokenProvider,
} from "./gmail-auth.js";
import { createGmailRestClient } from "./gmail-rest-client.js";

const config = loadGmailConfig(process.env);

const tokenProvider =
  config.accessToken !== undefined
    ? createStaticBearerTokenProvider(config.accessToken)
    : createGoogleAuthTokenProvider({
        scopes: config.scopes,
        ...(config.useDomainDelegation === true &&
        config.delegatedUserEmail !== undefined
          ? { subject: config.delegatedUserEmail }
          : {}),
      });

const client = createGmailRestClient({
  tokenProvider,
  requestTimeoutMs: config.requestTimeoutMs,
});

const connector = createGmailConnector({
  client,
  config,
  ...(config.accessToken !== undefined
    ? { accessTokenForRedaction: config.accessToken }
    : {}),
});

await serveStdio(connector);
