import { Readable } from "node:stream";

import snowflake from "snowflake-sdk";

import type {
  SnowflakeExecuteOptions,
  SnowflakeProviderClient,
  SnowflakeQueryResult,
} from "./provider-client.js";

export interface CreateSnowflakeSdkClientOptions {
  readonly account: string;
  readonly username: string;
  readonly password: string;
  readonly role: string;
  readonly warehouse: string;
  readonly database: string;
  /** Injectable driver connection for tests. Production uses snowflake-sdk. */
  readonly connection?: SnowflakeSdkConnection;
}

export interface SnowflakeSdkColumn {
  getName(): string;
  getType(): string;
}

export interface SnowflakeSdkStatement {
  cancel(callback?: (err?: Error) => void): void;
  getColumns(): SnowflakeSdkColumn[] | undefined;
  streamRows(options?: { start?: number; end?: number }): Readable;
}

export interface SnowflakeSdkExecuteOptions {
  sqlText: string;
  binds?: readonly (string | number | boolean | null)[];
  fetchAsString?: Array<"Number" | "Boolean" | "Date">;
  streamResult?: boolean;
  complete?: (
    err: Error | undefined,
    stmt: SnowflakeSdkStatement,
    rows?: unknown[],
  ) => void;
}

export interface SnowflakeSdkConnection {
  connect(callback: (err?: Error, conn?: SnowflakeSdkConnection) => void): void;
  destroy(callback: (err?: Error) => void): void;
  execute(options: SnowflakeSdkExecuteOptions): SnowflakeSdkStatement;
}

function abortError(message = "Query aborted."): Error {
  return Object.assign(new Error(message), { name: "AbortError" });
}

function timeoutError(): Error {
  return Object.assign(new Error("Query timed out."), {
    name: "TimeoutError",
  });
}

function promisifyConnect(
  connection: SnowflakeSdkConnection,
): Promise<SnowflakeSdkConnection> {
  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => {
      if (err !== undefined) {
        reject(err);
        return;
      }
      resolve(conn ?? connection);
    });
  });
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(abortError());
  }
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function promisifyDestroy(connection: SnowflakeSdkConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.destroy((err) => {
      if (err !== undefined) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function destroyStream(stream: Readable | undefined): void {
  if (stream !== undefined && !stream.destroyed) {
    stream.destroy();
  }
}

function executeStatement(
  connection: SnowflakeSdkConnection,
  options: SnowflakeExecuteOptions,
): Promise<SnowflakeQueryResult> {
  if (options.signal?.aborted) {
    return Promise.reject(abortError());
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let cancelRequested = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let stream: Readable | undefined;
    let statement: SnowflakeSdkStatement | undefined;

    function onAbort(): void {
      requestCancel(abortError());
    }

    function cleanup(): void {
      if (timeout !== undefined) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      if (options.signal !== undefined) {
        options.signal.removeEventListener("abort", onAbort);
      }
      destroyStream(stream);
      stream = undefined;
    }

    function settleReject(error: unknown): void {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    }

    function settleResolve(result: SnowflakeQueryResult): void {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    }

    function requestCancel(reason: Error): void {
      if (cancelRequested) {
        settleReject(reason);
        return;
      }
      cancelRequested = true;
      if (statement !== undefined) {
        try {
          statement.cancel((cancelErr) => {
            void cancelErr;
          });
        } catch {
          // Cancellation is best-effort; the caller still sees abort/timeout.
        }
      }
      settleReject(reason);
    }

    if (options.signal !== undefined) {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    timeout = setTimeout(() => {
      requestCancel(timeoutError());
    }, options.timeoutMs);

    try {
      statement = connection.execute({
        sqlText: options.sqlText,
        binds: [...options.binds],
        fetchAsString: ["Number", "Boolean", "Date"],
        streamResult: true,
        complete: (err, stmt) => {
          statement = stmt ?? statement;
          if (settled) {
            return;
          }
          if (err !== undefined) {
            settleReject(err);
            return;
          }
          consumeBoundedRows(
            stmt,
            options.maxRows,
            settleResolve,
            settleReject,
            (next) => {
              stream = next;
            },
          );
        },
      });
    } catch (error) {
      settleReject(error);
      return;
    }

    if (options.signal?.aborted) {
      requestCancel(abortError());
    }
  });
}

function consumeBoundedRows(
  stmt: SnowflakeSdkStatement,
  maxRows: number,
  settleResolve: (result: SnowflakeQueryResult) => void,
  settleReject: (error: unknown) => void,
  setStream: (stream: Readable) => void,
): void {
  const columns =
    stmt.getColumns()?.map((col) => ({
      name: col.getName(),
      dataType: col.getType(),
    })) ?? [];

  if (maxRows < 1) {
    settleResolve({ columns, rows: [], rowCount: 0 });
    return;
  }

  const rows: Record<string, unknown>[] = [];
  const stream = stmt.streamRows({ start: 0, end: maxRows - 1 });
  setStream(stream);

  stream.on("data", (row: unknown) => {
    if (rows.length >= maxRows) {
      return;
    }
    if (row !== null && typeof row === "object") {
      rows.push(row as Record<string, unknown>);
    }
  });
  stream.on("error", (error: Error) => {
    settleReject(error);
  });
  stream.on("end", () => {
    settleResolve({
      columns,
      rows,
      rowCount: rows.length,
    });
  });
}

export function createSnowflakeSdkProviderClient(
  options: CreateSnowflakeSdkClientOptions,
): SnowflakeProviderClient {
  snowflake.configure({ logLevel: "ERROR" });
  const connection: SnowflakeSdkConnection =
    options.connection ??
    (snowflake.createConnection({
      account: options.account,
      username: options.username,
      password: options.password,
      role: options.role,
      warehouse: options.warehouse,
      database: options.database,
    }) as unknown as SnowflakeSdkConnection);

  let connectPromise: Promise<SnowflakeSdkConnection> | undefined;
  let destroyed = false;

  async function ensureConnected(
    signal?: AbortSignal,
  ): Promise<SnowflakeSdkConnection> {
    if (destroyed) {
      throw new Error("Snowflake connection is destroyed.");
    }
    if (signal?.aborted) {
      throw abortError();
    }
    connectPromise ??= promisifyConnect(connection);
    return withAbort(connectPromise, signal);
  }

  return {
    async execute(executeOptions: SnowflakeExecuteOptions) {
      const conn = await ensureConnected(executeOptions.signal);
      if (executeOptions.signal?.aborted) {
        throw abortError();
      }
      return executeStatement(conn, executeOptions);
    },
    async destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      try {
        await promisifyDestroy(connection);
      } catch {
        // best-effort teardown
      }
    },
  };
}
