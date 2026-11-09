#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

import { loadSnowflakeConfig } from "./config.js";
import { createSnowflakeConnector } from "./connector.js";
import { createSnowflakeSdkProviderClient } from "./provider-sdk-client.js";

const config = loadSnowflakeConfig(process.env);
const client = createSnowflakeSdkProviderClient({
  account: config.account,
  username: config.username,
  password: config.password,
  role: config.role,
  warehouse: config.warehouse,
  database: config.database,
});
const connector = createSnowflakeConnector({ client, config });

await serveStdio(connector);
