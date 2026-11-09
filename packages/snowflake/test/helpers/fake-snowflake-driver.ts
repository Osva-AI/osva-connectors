import { Readable } from "node:stream";

import type {
  SnowflakeSdkConnection,
  SnowflakeSdkExecuteOptions,
  SnowflakeSdkStatement,
} from "../../src/provider-sdk-client.js";

export interface FakeSnowflakeColumn {
  readonly name: string;
  readonly dataType: string;
}

export class FakeSnowflakeStatement implements SnowflakeSdkStatement {
  cancelCount = 0;
  cancelled = false;
  streamRowsCalls: Array<{ start?: number; end?: number }> = [];
  private readonly rows: readonly Record<string, unknown>[];
  private readonly columns: readonly FakeSnowflakeColumn[];
  private readonly cancelError?: Error;
  private readonly onCancel?: () => void;

  constructor(options: {
    readonly rows: readonly Record<string, unknown>[];
    readonly columns: readonly FakeSnowflakeColumn[];
    readonly cancelError?: Error;
    readonly onCancel?: () => void;
  }) {
    this.rows = options.rows;
    this.columns = options.columns;
    this.cancelError = options.cancelError;
    this.onCancel = options.onCancel;
  }

  cancel(callback?: (err?: Error) => void): void {
    this.cancelCount += 1;
    this.cancelled = true;
    this.onCancel?.();
    queueMicrotask(() => {
      callback?.(this.cancelError);
    });
  }

  getColumns() {
    return this.columns.map((col) => ({
      getName: () => col.name,
      getType: () => col.dataType,
    }));
  }

  streamRows(options?: { start?: number; end?: number }): Readable {
    this.streamRowsCalls.push({
      start: options?.start,
      end: options?.end,
    });
    const start = options?.start ?? 0;
    const end = options?.end ?? this.rows.length - 1;
    const slice = this.rows.slice(start, end + 1);
    return Readable.from(slice, { objectMode: true });
  }
}

export class FakeSnowflakeConnection implements SnowflakeSdkConnection {
  connectCount = 0;
  destroyCount = 0;
  executeCount = 0;
  readonly executedSql: string[] = [];
  lastStatement?: FakeSnowflakeStatement;

  connectDelayMs = 0;
  executeDelayMs = 0;
  completeError?: Error;
  cancelError?: Error;
  emitCompleteAfterCancel = false;
  rows: Record<string, unknown>[] = [{ ID: 1, EMAIL: "a@example.com" }];
  columns: FakeSnowflakeColumn[] = [
    { name: "ID", dataType: "NUMBER" },
    { name: "EMAIL", dataType: "TEXT" },
  ];

  private connectTimer?: ReturnType<typeof setTimeout>;
  private completeTimer?: ReturnType<typeof setTimeout>;
  destroyed = false;

  connect(
    callback: (err?: Error, conn?: SnowflakeSdkConnection) => void,
  ): void {
    this.connectCount += 1;
    const done = (): void => {
      callback(undefined, this);
    };
    if (this.connectDelayMs > 0) {
      this.connectTimer = setTimeout(done, this.connectDelayMs);
      return;
    }
    queueMicrotask(done);
  }

  destroy(callback: (err?: Error) => void): void {
    this.destroyCount += 1;
    this.destroyed = true;
    if (this.connectTimer !== undefined) {
      clearTimeout(this.connectTimer);
      this.connectTimer = undefined;
    }
    if (this.completeTimer !== undefined) {
      clearTimeout(this.completeTimer);
      this.completeTimer = undefined;
    }
    queueMicrotask(() => {
      callback();
    });
  }

  execute(options: SnowflakeSdkExecuteOptions): SnowflakeSdkStatement {
    this.executeCount += 1;
    this.executedSql.push(options.sqlText);
    const stmt = new FakeSnowflakeStatement({
      rows: this.rows,
      columns: this.columns,
      cancelError: this.cancelError,
      onCancel: () => {
        if (!this.emitCompleteAfterCancel && this.completeTimer !== undefined) {
          clearTimeout(this.completeTimer);
          this.completeTimer = undefined;
        }
      },
    });
    this.lastStatement = stmt;

    const fireComplete = (): void => {
      if (stmt.cancelled && !this.emitCompleteAfterCancel) {
        return;
      }
      options.complete?.(this.completeError, stmt, undefined);
    };

    if (this.executeDelayMs > 0) {
      this.completeTimer = setTimeout(fireComplete, this.executeDelayMs);
    } else {
      queueMicrotask(fireComplete);
    }
    return stmt;
  }
}
