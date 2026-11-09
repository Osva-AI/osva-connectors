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
}

function promisifyConnect(
  connection: snowflake.Connection,
): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => {
      if (err !== undefined) {
        reject(err);
        return;
      }
      resolve(conn);
    });
  });
}

function promisifyDestroy(connection: snowflake.Connection): Promise<void> {
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

function executeStatement(
  connection: snowflake.Connection,
  options: SnowflakeExecuteOptions,
): Promise<SnowflakeQueryResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abortListener = () => {
      if (!settled) {
        settled = true;
        reject(
          Object.assign(new Error("Query aborted."), { name: "AbortError" }),
        );
      }
    };
    if (options.signal !== undefined) {
      if (options.signal.aborted) {
        reject(
          Object.assign(new Error("Query aborted."), { name: "AbortError" }),
        );
        return;
      }
      options.signal.addEventListener("abort", abortListener, { once: true });
    }

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(
          Object.assign(new Error("Query timed out."), {
            name: "TimeoutError",
          }),
        );
      }
    }, options.timeoutMs);

    connection.execute({
      sqlText: options.sqlText,
      binds: [...options.binds],
      fetchAsString: ["Number", "Boolean", "Date"],
      complete: (err, stmt, rows) => {
        clearTimeout(timeout);
        if (options.signal !== undefined) {
          options.signal.removeEventListener("abort", abortListener);
        }
        if (settled) {
          return;
        }
        settled = true;
        if (err !== undefined) {
          reject(err);
          return;
        }
        const columns =
          stmt?.getColumns()?.map((col) => ({
            name: col.getName(),
            dataType: col.getType(),
          })) ?? [];
        const objectRows = (rows ?? []).slice(0, options.maxRows) as Record<
          string,
          unknown
        >[];
        resolve({
          columns,
          rows: objectRows,
          rowCount: objectRows.length,
        });
      },
    });
  });
}

export function createSnowflakeSdkProviderClient(
  options: CreateSnowflakeSdkClientOptions,
): SnowflakeProviderClient {
  snowflake.configure({ logLevel: "ERROR" });
  const connection = snowflake.createConnection({
    account: options.account,
    username: options.username,
    password: options.password,
    role: options.role,
    warehouse: options.warehouse,
    database: options.database,
  });

  let connectPromise: Promise<snowflake.Connection> | undefined;
  let destroyed = false;

  async function ensureConnected(): Promise<snowflake.Connection> {
    if (destroyed) {
      throw new Error("Snowflake connection is destroyed.");
    }
    connectPromise ??= promisifyConnect(connection);
    return connectPromise;
  }

  return {
    async execute(executeOptions: SnowflakeExecuteOptions) {
      const conn = await ensureConnected();
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
