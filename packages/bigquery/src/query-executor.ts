import { ConnectorSdkError } from "@osva-ai/connector-sdk";

import { MAX_QUERY_CONCURRENCY } from "./constants.js";
import type { BigqueryConfig } from "./schemas.js";
import type {
  BigQueryProviderClient,
  QueryExecutionOptions,
  QueryExecutionResult,
} from "./provider-client.js";

export class QueryConcurrencyGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrency: number = MAX_QUERY_CONCURRENCY,
  ) {}

  get activeCount(): number {
    return this.active;
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new ConnectorSdkError("CANCELLED", "Request was cancelled.");
    }
    if (this.active < this.maxConcurrency) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        signal?.removeEventListener("abort", onAbort);
        const index = this.queue.indexOf(resolve);
        if (index >= 0) {
          this.queue.splice(index, 1);
        }
        reject(new ConnectorSdkError("CANCELLED", "Request was cancelled."));
      };
      if (signal !== undefined) {
        signal.addEventListener("abort", onAbort);
      }
      this.queue.push(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      });
    });
    this.active += 1;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next !== undefined) {
      next();
    }
  }
}

export class QueryExecutor {
  constructor(
    private readonly client: BigQueryProviderClient,
    private readonly config: BigqueryConfig,
    private readonly gate: QueryConcurrencyGate = new QueryConcurrencyGate(),
  ) {}

  async executeQuery(
    options: QueryExecutionOptions,
    signal?: AbortSignal,
  ): Promise<QueryExecutionResult> {
    await this.gate.acquire(signal);
    try {
      const dryRun = await this.client.dryRunQuery({
        ...options,
        location: this.config.location,
        maxBytesBilled: this.config.maxBytesBilled,
        timeoutMs: this.config.queryTimeoutMs,
        signal,
      });
      if (dryRun.bytesProcessed > this.config.maxBytesBilled) {
        throw new ConnectorSdkError(
          "FORBIDDEN",
          "Query would exceed the configured max bytes billed limit.",
        );
      }
      return await this.client.runQuery({
        ...options,
        location: this.config.location,
        maxBytesBilled: this.config.maxBytesBilled,
        timeoutMs: this.config.queryTimeoutMs,
        signal,
      });
    } finally {
      this.gate.release();
    }
  }
}
