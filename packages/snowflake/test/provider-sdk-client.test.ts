import { afterEach, describe, expect, it } from "vitest";

import { createSnowflakeSdkProviderClient } from "../src/provider-sdk-client.js";
import { FakeSnowflakeConnection } from "./helpers/fake-snowflake-driver.js";

function clientFor(connection: FakeSnowflakeConnection) {
  return createSnowflakeSdkProviderClient({
    account: "fixture-account",
    username: "fixture-user",
    password: "fixture-password",
    role: "FIXTURE_ROLE",
    warehouse: "FIXTURE_WH",
    database: "FIXTURE_DB",
    connection,
  });
}

const SQL = 'SELECT "ID" FROM "FIXTURE_DB"."APP"."USERS" LIMIT ?';

describe("snowflake-sdk statement cancellation and bounded fetch", () => {
  const clients: Array<{ destroy(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(
      clients.splice(0).map(async (client) => {
        try {
          await client.destroy();
        } catch {
          // ignore
        }
      }),
    );
  });

  it("completes a normal query without cancelling", async () => {
    const connection = new FakeSnowflakeConnection();
    const client = clientFor(connection);
    clients.push(client);
    const result = await client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 5_000,
      maxRows: 2,
    });
    expect(result.rowCount).toBe(1);
    expect(result.columns.map((col) => col.name)).toEqual(["ID", "EMAIL"]);
    expect(connection.lastStatement?.cancelCount).toBe(0);
    expect(connection.executeCount).toBe(1);
  });

  it("rejects a pre-aborted request without executing", async () => {
    const connection = new FakeSnowflakeConnection();
    const client = clientFor(connection);
    clients.push(client);
    const signal = AbortSignal.abort();
    await expect(
      client.execute({
        sqlText: SQL,
        binds: [2],
        timeoutMs: 5_000,
        maxRows: 2,
        signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(connection.executeCount).toBe(0);
  });

  it("aborts while connecting and does not execute", async () => {
    const connection = new FakeSnowflakeConnection();
    connection.connectDelayMs = 200;
    const client = clientFor(connection);
    clients.push(client);
    const controller = new AbortController();
    const pending = client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 5_000,
      maxRows: 2,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(connection.executeCount).toBe(0);
    expect(connection.connectCount).toBe(1);
  });

  it("cancels once when aborted during execution", async () => {
    const connection = new FakeSnowflakeConnection();
    connection.executeDelayMs = 200;
    const client = clientFor(connection);
    clients.push(client);
    const controller = new AbortController();
    const pending = client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 5_000,
      maxRows: 2,
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(connection.executeCount).toBe(1);
    expect(connection.lastStatement?.cancelCount).toBe(1);
  });

  it("requests remote cancel on timeout during execution", async () => {
    const connection = new FakeSnowflakeConnection();
    connection.executeDelayMs = 400;
    const client = clientFor(connection);
    clients.push(client);
    await expect(
      client.execute({
        sqlText: SQL,
        binds: [2],
        timeoutMs: 30,
        maxRows: 2,
      }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(connection.lastStatement?.cancelCount).toBe(1);
  });

  it("cancels only once when timeout and abort race", async () => {
    const connection = new FakeSnowflakeConnection();
    connection.executeDelayMs = 400;
    const client = clientFor(connection);
    clients.push(client);
    const controller = new AbortController();
    const pending = client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 40,
      maxRows: 2,
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(Error);
    expect(connection.lastStatement?.cancelCount).toBe(1);
  });

  it("still fails the request when the cancel API errors", async () => {
    const connection = new FakeSnowflakeConnection();
    connection.executeDelayMs = 200;
    connection.cancelError = new Error("cancel failed");
    const client = clientFor(connection);
    clients.push(client);
    const controller = new AbortController();
    const pending = client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 5_000,
      maxRows: 2,
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(connection.lastStatement?.cancelCount).toBe(1);
  });

  it("ignores completion after cancellation and does not succeed", async () => {
    const connection = new FakeSnowflakeConnection();
    connection.executeDelayMs = 40;
    connection.emitCompleteAfterCancel = true;
    const client = clientFor(connection);
    clients.push(client);
    const controller = new AbortController();
    const pending = client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 5_000,
      maxRows: 2,
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not cancel after successful completion", async () => {
    const connection = new FakeSnowflakeConnection();
    const client = clientFor(connection);
    clients.push(client);
    const controller = new AbortController();
    const result = await client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 5_000,
      maxRows: 2,
      signal: controller.signal,
    });
    expect(result.rowCount).toBe(1);
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(connection.lastStatement?.cancelCount).toBe(0);
  });

  it("streams only the requested row window and does not retain extras", async () => {
    const connection = new FakeSnowflakeConnection();
    connection.rows = Array.from({ length: 20 }, (_, index) => ({
      ID: index + 1,
    }));
    const client = clientFor(connection);
    clients.push(client);
    const result = await client.execute({
      sqlText: SQL,
      binds: [3],
      timeoutMs: 5_000,
      maxRows: 3,
    });
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => row.ID)).toEqual([1, 2, 3]);
    expect(connection.lastStatement?.streamRowsCalls).toEqual([
      { start: 0, end: 2 },
    ]);
  });

  it("does not replay the statement after cancel", async () => {
    const connection = new FakeSnowflakeConnection();
    connection.executeDelayMs = 200;
    const client = clientFor(connection);
    clients.push(client);
    const controller = new AbortController();
    const pending = client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 5_000,
      maxRows: 2,
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(connection.executeCount).toBe(1);
    expect(connection.executedSql).toEqual([SQL]);
  });

  it("destroys the connection on teardown", async () => {
    const connection = new FakeSnowflakeConnection();
    const client = clientFor(connection);
    await client.execute({
      sqlText: SQL,
      binds: [2],
      timeoutMs: 5_000,
      maxRows: 2,
    });
    await client.destroy();
    await client.destroy();
    expect(connection.destroyCount).toBe(1);
  });
});
