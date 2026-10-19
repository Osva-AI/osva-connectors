#!/usr/bin/env node
import { createMcpServerFromConnector } from "@osva-ai/connector-sdk";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

import { loadPostgresConfig } from "./config.js";
import { createPostgresConnector } from "./connector.js";
import { createPgDatabase, createPostgresPool } from "./postgres-client.js";

let poolEnded = false;

async function shutdownPool(database: { end(): Promise<void> }): Promise<void> {
  if (poolEnded) {
    return;
  }
  poolEnded = true;
  try {
    await database.end();
  } catch {
    // Best-effort cleanup; avoid leaking pool handles on exit.
  }
}

function registerShutdownHandlers(database: { end(): Promise<void> }): void {
  const onSignal = (): void => {
    void shutdownPool(database).finally(() => {
      process.exit(0);
    });
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
}

const config = loadPostgresConfig(process.env);
const pool = createPostgresPool(config);
const database = createPgDatabase(pool, config);
registerShutdownHandlers(database);

const connector = createPostgresConnector({
  database,
  pool,
  allowedSchemas: config.allowedSchemas,
  queryTimeoutMs: config.queryTimeoutMs,
  totalTimeoutMs: config.totalTimeoutMs,
});

const server = createMcpServerFromConnector(connector);
const transport = new StdioServerTransport();

await new Promise<void>((resolve, reject) => {
  transport.onclose = () => {
    void shutdownPool(database).finally(() => {
      resolve();
    });
  };
  transport.onerror = (error) => {
    void shutdownPool(database).finally(() => {
      reject(error);
    });
  };
  server.connect(transport).catch((error: unknown) => {
    void shutdownPool(database).finally(() => {
      reject(error);
    });
  });
});
