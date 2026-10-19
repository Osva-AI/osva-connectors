export interface ReadOnlySelectExecutionMetrics {
  connectMs?: number;
}

export interface ReadOnlySelectExecutionOptions {
  readonly sql: string;
  readonly params: readonly unknown[];
  readonly maxRows: number;
  readonly statementTimeoutMs: number;
  readonly lockTimeoutMs: number;
  readonly totalTimeoutMs: number;
  readonly signal?: AbortSignal;
  readonly metrics?: ReadOnlySelectExecutionMetrics;
}

export interface ReadOnlySelectExecutionResult {
  readonly columns: ReadonlyArray<{ name: string; dataType: string }>;
  readonly rows: unknown[][];
  readonly rowCount: number;
  readonly truncated: boolean;
}
