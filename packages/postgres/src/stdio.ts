#!/usr/bin/env node
import { serveStdio } from "@osva-ai/connector-sdk";

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
const database = createPgDatabase(pool);
registerShutdownHandlers(database);

const connector = createPostgresConnector({ database });

try {
  await serveStdio(connector);
} finally {
  await shutdownPool(database);
}
