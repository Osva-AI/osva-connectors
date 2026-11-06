#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import {
  createGoogleAuthTokenProvider,
  createStaticBearerTokenProvider,
} from "./calendar-auth.js";
import { createCalendarRestClient } from "./calendar-rest-client.js";
import { loadGoogleCalendarConfig } from "./config.js";
import { createGoogleCalendarConnector } from "./connector.js";

const config = loadGoogleCalendarConfig(process.env);

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

const client = createCalendarRestClient({
  tokenProvider,
  requestTimeoutMs: config.requestTimeoutMs,
});

const connector = createGoogleCalendarConnector({
  client,
  config,
  ...(config.accessToken !== undefined
    ? { accessTokenForRedaction: config.accessToken }
    : {}),
});

await serveStdio(connector);
